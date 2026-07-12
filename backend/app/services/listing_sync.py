"""Ensure landlord/seller leads have inventory listings for the Properties page."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.listing import Listing
from app.models.requirement import LeadRequirement

logger = logging.getLogger(__name__)

SUPPLY_ROLES = {"landlord", "seller"}


def _listing_from_requirement(req: LeadRequirement, created_by_id: UUID | None) -> Listing:
    anchors = req.location_anchors or []
    area = None
    lat = lng = None
    if anchors:
        first = anchors[0] if isinstance(anchors[0], dict) else {}
        area = first.get("name")
        lat = first.get("lat")
        lng = first.get("lng")
    if not area and req.preferred_locations:
        area = req.preferred_locations[0]
    loc_parts = [p for p in [area, req.city] if p]
    prop_type = (req.property_types or [None])[0]
    title = " · ".join([p for p in [req.bhk, prop_type, area or req.city] if p]) or "Property"
    price = req.rent_budget if req.stream_type == "rental" else (req.budget_max or req.budget_min)
    return Listing(
        contact_id=req.contact_id,
        stream_type=req.stream_type,
        title=title,
        location_text=", ".join(loc_parts) if loc_parts else None,
        latitude=lat,
        longitude=lng,
        bhk=req.bhk,
        property_type=prop_type,
        price=price,
        monthly_rent=req.rent_budget if req.stream_type == "rental" else None,
        security_deposit=req.security_deposit if req.role == "landlord" else None,
        maintenance=req.maintenance if req.role == "landlord" else None,
        total_amount=price if req.stream_type == "sales" else None,
        description=req.notes,
        status="available",
        created_by_id=created_by_id,
    )


async def sync_listings_from_supply_leads(db: AsyncSession) -> dict:
    """
    Link or create listings for active landlord/seller requirements.
    Does not delete anything — only fills gaps so Properties shows all supply leads.
    """
    reqs = (
        await db.execute(
            select(LeadRequirement).where(
                LeadRequirement.role.in_(SUPPLY_ROLES),
                LeadRequirement.status.in_(["active", "matched"]),
            )
        )
    ).scalars().all()

    linked_ids = {
        r.listing_id
        for r in reqs
        if r.listing_id is not None
    }

    contact_listings: dict[UUID, list[Listing]] = {}
    all_listings = (
        await db.execute(
            select(Listing).where(Listing.status == "available").options(selectinload(Listing.media))
        )
    ).scalars().all()
    for listing in all_listings:
        if listing.contact_id:
            contact_listings.setdefault(listing.contact_id, []).append(listing)

    linked = 0
    created = 0
    for req in reqs:
        if req.listing_id:
            continue
        # Prefer an existing listing for this contact that isn't already linked.
        candidates = [
            l
            for l in contact_listings.get(req.contact_id, [])
            if l.id not in linked_ids and l.stream_type == req.stream_type
        ]
        if candidates:
            # Best effort: same BHK if possible, else newest.
            match = next((l for l in candidates if req.bhk and l.bhk == req.bhk), None)
            listing = match or sorted(candidates, key=lambda x: x.updated_at or x.created_at, reverse=True)[0]
            req.listing_id = listing.id
            linked_ids.add(listing.id)
            linked += 1
            continue

        listing = _listing_from_requirement(req, req.assigned_user_id)
        db.add(listing)
        await db.flush()
        req.listing_id = listing.id
        linked_ids.add(listing.id)
        contact_listings.setdefault(req.contact_id, []).append(listing)
        created += 1

    if linked or created:
        await db.commit()
        logger.info("Synced supply leads to listings: linked=%s created=%s", linked, created)
    return {"linked": linked, "created": created}
