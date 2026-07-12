"""Match lead requirements against available listings and inventory specs."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact
from app.models.inventory import Location, Project, UnitOption, UnitSpec
from app.models.listing import Listing
from app.models.requirement import LeadRequirement, RequirementMatch
from app.services.geo import build_anchors, distance_bucket, haversine_km, min_distance_km, property_coords

BUDGET_TOLERANCE = 0.10


def _norm(s: str | None) -> str:
    return (s or "").lower().strip()


def _bhk_match(req_bhk: str | None, prop_bhk: str | None) -> bool:
    if not req_bhk:
        return True
    if not prop_bhk:
        return True
    req_nums = re.findall(r"\d+", req_bhk)
    prop_nums = re.findall(r"\d+", prop_bhk)
    if req_nums and prop_nums:
        return req_nums[0] == prop_nums[0]
    return _norm(req_bhk) in _norm(prop_bhk) or _norm(prop_bhk) in _norm(req_bhk)


def _location_match(req: LeadRequirement, contact: Contact | None, *texts: str | None) -> bool:
    anchors = build_anchors(req, contact)
    if anchors:
        return True
    locations = req.preferred_locations
    if req.city and not locations:
        haystack = " ".join(_norm(t) for t in texts if t)
        return _norm(req.city) in haystack or haystack in _norm(req.city)
    if not locations:
        return True
    haystack = " ".join(_norm(t) for t in texts if t)
    if not haystack:
        return False
    return any(_norm(loc) in haystack or haystack in _norm(loc) for loc in locations)


def _geo_match(
    req: LeadRequirement,
    contact: Contact | None,
    lat: float | None,
    lng: float | None,
) -> bool:
    anchors = build_anchors(req, contact)
    if not anchors or lat is None or lng is None:
        return True
    radius = req.search_radius_km or 5.0
    if radius <= 0:
        return True
    dist = min_distance_km(lat, lng, anchors)
    if dist is None:
        return True
    if dist <= radius:
        return True
    if dist <= 10:
        return True
    if req.city:
        return True
    return dist <= max(radius, 10)


def _property_type_match(required: list[str] | None, actual: str | None) -> bool:
    if not required:
        return True
    if not actual:
        return True
    return _norm(actual) in [_norm(r) for r in required]


def _budget_match(req: LeadRequirement, price: float | None) -> bool:
    if price is None:
        return True
    if req.stream_type == "rental":
        if req.rent_budget is None:
            return True
        return price <= req.rent_budget * (1 + BUDGET_TOLERANCE)
    lo = req.budget_min
    hi = req.budget_max
    if lo is None and hi is None:
        return True
    if lo is not None and price < lo * (1 - BUDGET_TOLERANCE):
        return False
    if hi is not None and price > hi * (1 + BUDGET_TOLERANCE):
        return False
    return True


def _score(req: LeadRequirement, *, bhk_ok: bool, loc_ok: bool, type_ok: bool, budget_ok: bool, dist_km: float | None) -> int:
    score = 0
    if bhk_ok:
        score += 20
    if loc_ok:
        score += 25
    if type_ok:
        score += 15
    if budget_ok:
        score += 20
    if dist_km is not None:
        radius = req.search_radius_km or 5.0
        if dist_km <= radius:
            score += 20
        elif dist_km <= 10:
            score += 10
        else:
            score += 5
    else:
        score += 10
    return score


def _prop_dict(
    *,
    listing: Listing | None = None,
    spec: UnitSpec | None = None,
    dist_km: float | None = None,
    bucket: str,
) -> dict:
    if listing:
        cover = listing.media[0].file_path if listing.media else None
        owner = listing.contact
        return {
            "source": "listing",
            "listing_id": str(listing.id),
            "spec_id": None,
            "title": listing.title,
            "location": listing.location_text,
            "bhk": listing.bhk,
            "price": listing.price,
            "property_type": listing.property_type,
            "stream_type": listing.stream_type,
            "cover_url": f"/listings/media/{cover}" if cover else None,
            "distance_km": round(dist_km, 1) if dist_km is not None else None,
            "bucket": bucket,
            "contact_name": owner.name if owner else None,
            "contact_phone": owner.phone if owner else None,
            "contact_whatsapp": (owner.whatsapp or owner.phone) if owner else None,
        }
    option = spec.option if spec else None
    project = option.project if option else None
    location = project.location if project else None
    return {
        "source": "spec",
        "listing_id": None,
        "spec_id": str(spec.id) if spec else None,
        "title": project.name if project else "Unit",
        "location": f"{location.area}, {location.city}" if location else None,
        "bhk": option.configuration if option else None,
        "price": spec.rent_price or spec.sale_price if spec else None,
        "property_type": None,
        "stream_type": spec.stream_type if spec else None,
        "cover_url": None,
        "distance_km": round(dist_km, 1) if dist_km is not None else None,
        "bucket": bucket,
    }


async def _load_req(db: AsyncSession, requirement_id: UUID) -> tuple[LeadRequirement, Contact] | None:
    result = await db.execute(
        select(LeadRequirement)
        .options(selectinload(LeadRequirement.contact))
        .where(LeadRequirement.id == requirement_id)
    )
    req = result.scalar_one_or_none()
    if not req or not req.contact:
        return None
    return req, req.contact


async def find_available_properties(db: AsyncSession, requirement_id: UUID) -> dict:
    loaded = await _load_req(db, requirement_id)
    if not loaded:
        return {"within_radius": [], "within_10km": [], "in_city": [], "search_radius_km": 5}
    req, contact = loaded
    anchors = build_anchors(req, contact)
    primary_radius = req.search_radius_km or 5.0
    buckets: dict[str, list] = {"within_radius": [], "within_10km": [], "in_city": []}

    listings = (
        await db.execute(
            select(Listing)
            .options(selectinload(Listing.media), selectinload(Listing.contact))
            .where(Listing.status == "available", Listing.stream_type == req.stream_type)
        )
    ).scalars().all()

    for listing in listings:
        loc_ok = _location_match(req, contact, listing.location_text, listing.title, req.city)
        if not loc_ok:
            continue
        if not _bhk_match(req.bhk, listing.bhk):
            continue
        if not _property_type_match(req.property_types, listing.property_type):
            continue
        if not _budget_match(req, listing.price):
            continue
        coords = property_coords(listing_lat=listing.latitude, listing_lng=listing.longitude)
        dist = min_distance_km(coords[0], coords[1], anchors) if coords and anchors else None
        if coords and anchors and not _geo_match(req, contact, coords[0], coords[1]):
            if not req.city or _norm(req.city) not in _norm(listing.location_text or ""):
                continue
        bucket = distance_bucket(dist, primary_radius, has_anchors=bool(anchors))
        buckets[bucket].append(_prop_dict(listing=listing, dist_km=dist, bucket=bucket))

    specs = (
        await db.execute(
            select(UnitSpec)
            .where(UnitSpec.status == "available", UnitSpec.stream_type == req.stream_type)
            .options(selectinload(UnitSpec.option).selectinload(UnitOption.project).selectinload(Project.location))
        )
    ).scalars().all()

    for spec in specs:
        option = spec.option
        project = option.project if option else None
        location = project.location if project else None
        area = location.area if location else None
        city = location.city if location else None
        if not _location_match(req, contact, area, city, project.name if project else None, req.city):
            continue
        if not _bhk_match(req.bhk, option.configuration if option else None):
            continue
        if not _property_type_match(req.property_types, None):
            continue
        price = spec.rent_price if req.stream_type == "rental" else spec.sale_price
        if not _budget_match(req, price):
            continue
        lat = location.latitude if location else None
        lng = location.longitude if location else None
        dist = min_distance_km(lat, lng, anchors) if lat is not None and lng is not None and anchors else None
        if lat is not None and anchors and not _geo_match(req, contact, lat, lng):
            if not req.city or _norm(req.city) not in _norm(city or ""):
                continue
        bucket = distance_bucket(dist, primary_radius, has_anchors=bool(anchors))
        buckets[bucket].append(_prop_dict(spec=spec, dist_km=dist, bucket=bucket))

    for key in buckets:
        buckets[key].sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 999))

    return {
        **buckets,
        "search_radius_km": primary_radius,
        "anchors": anchors,
    }


async def _upsert_match(
    db: AsyncSession,
    requirement_id: UUID,
    *,
    listing_id: UUID | None = None,
    spec_id: UUID | None = None,
    match_score: int,
) -> RequirementMatch | None:
    stmt = select(RequirementMatch).where(RequirementMatch.requirement_id == requirement_id)
    if listing_id:
        stmt = stmt.where(RequirementMatch.listing_id == listing_id)
    else:
        stmt = stmt.where(RequirementMatch.spec_id == spec_id)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        if existing.status in ("rejected", "closed"):
            return None
        existing.match_score = match_score
        return existing
    match = RequirementMatch(
        requirement_id=requirement_id,
        listing_id=listing_id,
        spec_id=spec_id,
        match_score=match_score,
        status="new",
    )
    db.add(match)
    return match


async def match_requirement(db: AsyncSession, requirement_id: UUID) -> int:
    loaded = await _load_req(db, requirement_id)
    if not loaded:
        return 0
    req, contact = loaded
    if req.status not in ("active", "matched"):
        return 0

    available = await find_available_properties(db, requirement_id)
    created = 0
    for key in ("within_radius", "within_10km", "in_city"):
        for item in available.get(key, []):
            listing_id = UUID(item["listing_id"]) if item.get("listing_id") else None
            spec_id = UUID(item["spec_id"]) if item.get("spec_id") else None
            score = 70 if item.get("bucket") == "within_radius" else 60 if item.get("bucket") == "within_10km" else 55
            m = await _upsert_match(
                db, req.id, listing_id=listing_id, spec_id=spec_id, match_score=score
            )
            if m and m.status == "new":
                created += 1

    if created > 0 and req.status == "active":
        req.status = "matched"
    await db.commit()
    return created


async def match_all_active(db: AsyncSession) -> int:
    reqs = (
        await db.execute(
            select(LeadRequirement).where(LeadRequirement.status.in_(["active", "matched"]))
        )
    ).scalars().all()
    total = 0
    for req in reqs:
        total += await match_requirement(db, req.id)
    return total
