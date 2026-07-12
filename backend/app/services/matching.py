"""Match lead requirements against available listings, inventory specs, and counterpart leads."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact
from app.models.inventory import Project, UnitOption, UnitSpec
from app.models.listing import Listing
from app.models.requirement import LeadRequirement, RequirementMatch
from app.services.geo import build_anchors, distance_bucket, haversine_km, min_distance_km, property_coords

BUDGET_TOLERANCE = 0.10

COUNTERPART_ROLE = {
    "landlord": "renter",
    "renter": "landlord",
    "seller": "buyer",
    "buyer": "seller",
}
SUPPLY_ROLES = {"landlord", "seller"}


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


def _property_types_overlap(a: list[str] | None, b: list[str] | None) -> bool:
    if not a or not b:
        return True
    return bool({_norm(x) for x in a} & {_norm(x) for x in b})


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


def _supply_demand_budget(supply: LeadRequirement, demand: LeadRequirement) -> bool:
    if supply.stream_type == "rental":
        asking = supply.rent_budget
        budget = demand.rent_budget
        if asking is None or budget is None:
            return True
        return budget >= asking * (1 - BUDGET_TOLERANCE)
    asking = supply.budget_max or supply.budget_min
    lo = demand.budget_min
    hi = demand.budget_max
    if asking is None:
        return True
    if lo is None and hi is None:
        return True
    if lo is not None and asking < lo * (1 - BUDGET_TOLERANCE):
        return False
    if hi is not None and asking > hi * (1 + BUDGET_TOLERANCE):
        return False
    return True


def _tenant_type_ok(supply: LeadRequirement, demand_contact: Contact) -> bool:
    preferred = supply.preferred_tenant_types
    if not preferred:
        return True
    tenant_type = demand_contact.tenant_type
    if not tenant_type:
        return True
    return _norm(tenant_type) in {_norm(t) for t in preferred}


def _leads_location_ok(
    a: LeadRequirement,
    a_contact: Contact,
    b: LeadRequirement,
    b_contact: Contact,
) -> tuple[bool, float | None]:
    """Require a real location link — never match across unrelated cities/areas."""
    a_city = _norm(a.city)
    b_city = _norm(b.city)
    a_locs = {_norm(x) for x in (a.preferred_locations or []) if x}
    b_locs = {_norm(x) for x in (b.preferred_locations or []) if x}
    a_anchors = build_anchors(a, a_contact)
    b_anchors = build_anchors(b, b_contact)

    # Different cities never match.
    if a_city and b_city and a_city != b_city:
        return False, None

    # Same city is enough for a candidate (radius/areas refine score elsewhere).
    if a_city and b_city and a_city == b_city:
        if a_anchors and b_anchors:
            dists = [
                haversine_km(aa["lat"], aa["lng"], bb["lat"], bb["lng"])
                for aa in a_anchors
                for bb in b_anchors
                if aa.get("lat") is not None and bb.get("lat") is not None
            ]
            if dists:
                dist = min(dists)
                # Whole-city mode: same city already confirmed.
                if a.search_radius_km == 0 or b.search_radius_km == 0:
                    return True, dist
                radius = max(a.search_radius_km or 5.0, b.search_radius_km or 5.0, 10.0)
                return dist <= radius, dist
        return True, None

    # Exact preferred-area overlap (e.g. both "Palazhi").
    if a_locs and b_locs and (a_locs & b_locs):
        return True, None

    # City name appears in the other side's preferred areas.
    if a_city and a_city in b_locs:
        return True, None
    if b_city and b_city in a_locs:
        return True, None

    # Lat/lng anchors within radius — only when we don't already know cities conflict.
    if a_anchors and b_anchors:
        dists = [
            haversine_km(aa["lat"], aa["lng"], bb["lat"], bb["lng"])
            for aa in a_anchors
            for bb in b_anchors
            if aa.get("lat") is not None and bb.get("lat") is not None
        ]
        if dists:
            dist = min(dists)
            # Do not treat "whole city" as unlimited when cities are unknown/different.
            if a.search_radius_km == 0 or b.search_radius_km == 0:
                return False, dist
            radius = max(a.search_radius_km or 5.0, b.search_radius_km or 5.0, 10.0)
            return dist <= radius, dist

    # One or both sides have location signals but nothing overlaps → no match.
    return False, None


def _leads_compatible(
    left: LeadRequirement,
    left_contact: Contact,
    right: LeadRequirement,
    right_contact: Contact,
) -> tuple[bool, int, float | None]:
    if left.stream_type != right.stream_type:
        return False, 0, None
    if left.role not in COUNTERPART_ROLE or COUNTERPART_ROLE[left.role] != right.role:
        return False, 0, None

    if left.role in SUPPLY_ROLES:
        supply, supply_c, demand, demand_c = left, left_contact, right, right_contact
    else:
        supply, supply_c, demand, demand_c = right, right_contact, left, left_contact

    if not _property_types_overlap(supply.property_types, demand.property_types):
        return False, 0, None
    if supply.bhk and demand.bhk and not _bhk_match(demand.bhk, supply.bhk):
        return False, 0, None
    if not _supply_demand_budget(supply, demand):
        return False, 0, None
    if supply.role == "landlord" and not _tenant_type_ok(supply, demand_c):
        return False, 0, None

    loc_ok, dist = _leads_location_ok(supply, supply_c, demand, demand_c)
    if not loc_ok:
        return False, 0, dist

    score = 50
    if supply.bhk and demand.bhk:
        score += 15
    if supply.property_types and demand.property_types:
        score += 10
    if supply.stream_type == "rental" and supply.rent_budget and demand.rent_budget:
        score += 15
    if dist is not None and dist <= (demand.search_radius_km or 5):
        score += 20
    elif dist is not None and dist <= 10:
        score += 10
    else:
        score += 5
    return True, score, dist


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
            "matched_requirement_id": None,
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
        "matched_requirement_id": None,
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


def _lead_match_dict(
    other: LeadRequirement,
    other_contact: Contact,
    *,
    dist_km: float | None,
    bucket: str,
    score: int,
) -> dict:
    locs = other.preferred_locations or []
    location = ", ".join(locs) if locs else other.city
    price = other.rent_budget if other.stream_type == "rental" else (other.budget_max or other.budget_min)
    if other.role in SUPPLY_ROLES:
        title = f"{other_contact.name}'s property"
    else:
        title = f"{other_contact.name} looking for {other.bhk or 'property'}"
    return {
        "source": "lead",
        "listing_id": None,
        "spec_id": None,
        "matched_requirement_id": str(other.id),
        "title": title,
        "location": location,
        "bhk": other.bhk,
        "price": price,
        "property_type": (other.property_types or [None])[0],
        "stream_type": other.stream_type,
        "cover_url": None,
        "distance_km": round(dist_km, 1) if dist_km is not None else None,
        "bucket": bucket,
        "match_score": score,
        "contact_name": other_contact.name,
        "contact_phone": other_contact.phone,
        "contact_whatsapp": other_contact.whatsapp or other_contact.phone,
        "matched_role": other.role,
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


async def find_counterpart_leads(db: AsyncSession, requirement_id: UUID) -> dict:
    loaded = await _load_req(db, requirement_id)
    if not loaded:
        return {"within_radius": [], "within_10km": [], "in_city": [], "search_radius_km": 5}
    req, contact = loaded
    counterpart = COUNTERPART_ROLE.get(req.role)
    if not counterpart:
        return {"within_radius": [], "within_10km": [], "in_city": [], "search_radius_km": 5}

    primary_radius = req.search_radius_km or 5.0
    buckets: dict[str, list] = {"within_radius": [], "within_10km": [], "in_city": []}

    others = (
        await db.execute(
            select(LeadRequirement)
            .options(selectinload(LeadRequirement.contact))
            .where(
                LeadRequirement.role == counterpart,
                LeadRequirement.stream_type == req.stream_type,
                LeadRequirement.status.in_(["active", "matched"]),
                LeadRequirement.id != req.id,
            )
        )
    ).scalars().all()

    for other in others:
        if not other.contact or other.contact_id == req.contact_id:
            continue
        ok, score, dist = _leads_compatible(req, contact, other, other.contact)
        if not ok:
            continue
        bucket = distance_bucket(dist, primary_radius, has_anchors=bool(build_anchors(req, contact)))
        buckets[bucket].append(
            _lead_match_dict(other, other.contact, dist_km=dist, bucket=bucket, score=score)
        )

    for key in buckets:
        buckets[key].sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 999))

    return {
        **buckets,
        "search_radius_km": primary_radius,
        "anchors": build_anchors(req, contact),
    }


async def find_available_properties(db: AsyncSession, requirement_id: UUID) -> dict:
    loaded = await _load_req(db, requirement_id)
    if not loaded:
        return {"within_radius": [], "within_10km": [], "in_city": [], "search_radius_km": 5}
    req, contact = loaded

    # Landlords/sellers match against demand leads, not inventory listings.
    if req.role in SUPPLY_ROLES:
        return await find_counterpart_leads(db, requirement_id)

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

    # Also include matching supply leads (landlords/sellers).
    lead_buckets = await find_counterpart_leads(db, requirement_id)
    for key in buckets:
        buckets[key].extend(lead_buckets.get(key, []))
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
    matched_requirement_id: UUID | None = None,
    match_score: int,
) -> RequirementMatch | None:
    stmt = select(RequirementMatch).where(RequirementMatch.requirement_id == requirement_id)
    if listing_id:
        stmt = stmt.where(RequirementMatch.listing_id == listing_id)
    elif matched_requirement_id:
        stmt = stmt.where(RequirementMatch.matched_requirement_id == matched_requirement_id)
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
        matched_requirement_id=matched_requirement_id,
        match_score=match_score,
        status="new",
    )
    db.add(match)
    return match


async def match_requirement(db: AsyncSession, requirement_id: UUID) -> int:
    loaded = await _load_req(db, requirement_id)
    if not loaded:
        return 0
    req, _contact = loaded
    if req.status not in ("active", "matched"):
        return 0

    available = await find_available_properties(db, requirement_id)
    created = 0
    valid_lead_ids: set[UUID] = set()
    for key in ("within_radius", "within_10km", "in_city"):
        for item in available.get(key, []):
            listing_id = UUID(item["listing_id"]) if item.get("listing_id") else None
            spec_id = UUID(item["spec_id"]) if item.get("spec_id") else None
            matched_req_id = (
                UUID(item["matched_requirement_id"]) if item.get("matched_requirement_id") else None
            )
            score = item.get("match_score") or (
                70 if item.get("bucket") == "within_radius" else 60 if item.get("bucket") == "within_10km" else 55
            )
            m = await _upsert_match(
                db,
                req.id,
                listing_id=listing_id,
                spec_id=spec_id,
                matched_requirement_id=matched_req_id,
                match_score=int(score),
            )
            if m and m.status == "new":
                created += 1

            # Mirror lead↔lead matches onto the counterpart requirement.
            if matched_req_id:
                valid_lead_ids.add(matched_req_id)
                reverse = await _upsert_match(
                    db,
                    matched_req_id,
                    matched_requirement_id=req.id,
                    match_score=int(score),
                )
                if reverse and reverse.status == "new":
                    created += 1
                other = (
                    await db.execute(select(LeadRequirement).where(LeadRequirement.id == matched_req_id))
                ).scalar_one_or_none()
                if other and other.status == "active":
                    other.status = "matched"

    # Drop false-positive lead matches that no longer pass location rules.
    stale = (
        await db.execute(
            select(RequirementMatch).where(
                RequirementMatch.requirement_id == req.id,
                RequirementMatch.matched_requirement_id.isnot(None),
                RequirementMatch.status == "new",
            )
        )
    ).scalars().all()
    for old in stale:
        if old.matched_requirement_id not in valid_lead_ids:
            old.status = "rejected"
            mirror = (
                await db.execute(
                    select(RequirementMatch).where(
                        RequirementMatch.requirement_id == old.matched_requirement_id,
                        RequirementMatch.matched_requirement_id == req.id,
                        RequirementMatch.status == "new",
                    )
                )
            ).scalar_one_or_none()
            if mirror:
                mirror.status = "rejected"

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
