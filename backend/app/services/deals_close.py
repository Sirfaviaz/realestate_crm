"""Close a successful match: archive both sides and remove from matching/Properties."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Activity, Deal
from app.models.listing import Listing
from app.models.requirement import LeadRequirement, RequirementMatch

DEMAND_ROLES = {"renter", "buyer"}
SUPPLY_ROLES = {"landlord", "seller"}


async def _close_open_matches_for_requirement(db: AsyncSession, requirement_id: UUID) -> None:
    rows = (
        await db.execute(
            select(RequirementMatch).where(
                or_(
                    RequirementMatch.requirement_id == requirement_id,
                    RequirementMatch.matched_requirement_id == requirement_id,
                ),
                RequirementMatch.status.notin_(["closed", "rejected"]),
            )
        )
    ).scalars().all()
    for m in rows:
        m.status = "closed"


async def close_match_as_deal(
    db: AsyncSession,
    match: RequirementMatch,
    *,
    user_id: UUID | None,
    notes: str | None = None,
    commission_amount: float | None = None,
    commission_received: bool = False,
) -> Deal:
    """Mark renter/buyer + property as done; hide from Properties and future matching."""
    req = match.requirement
    other = match.matched_requirement
    listing: Listing | None = match.listing

    demand: LeadRequirement | None = None
    supply: LeadRequirement | None = None
    if req:
        if req.role in DEMAND_ROLES:
            demand = req
        elif req.role in SUPPLY_ROLES:
            supply = req
    if other:
        if other.role in DEMAND_ROLES:
            demand = demand or other
        elif other.role in SUPPLY_ROLES:
            supply = supply or other

    if supply and not listing and supply.listing_id:
        listing = (
            await db.execute(select(Listing).where(Listing.id == supply.listing_id))
        ).scalar_one_or_none()

    contact_id = (
        (demand.contact_id if demand else None)
        or (req.contact_id if req else None)
        or (other.contact_id if other else None)
    )
    if not contact_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot close match without a contact")

    match.status = "closed"
    if notes:
        match.notes = notes
    if match.matched_requirement_id:
        mirror = (
            await db.execute(
                select(RequirementMatch).where(
                    RequirementMatch.requirement_id == match.matched_requirement_id,
                    RequirementMatch.matched_requirement_id == match.requirement_id,
                )
            )
        ).scalar_one_or_none()
        if mirror:
            mirror.status = "closed"

    if demand:
        demand.status = "closed"
        await _close_open_matches_for_requirement(db, demand.id)

    if supply:
        supply.status = "closed"
        await _close_open_matches_for_requirement(db, supply.id)

    stream = (
        demand.stream_type
        if demand
        else supply.stream_type
        if supply
        else (req.stream_type if req else "rental")
    )

    if listing:
        listing.status = "rented" if stream == "rental" else "sold"
        linked = (
            await db.execute(
                select(LeadRequirement).where(
                    LeadRequirement.listing_id == listing.id,
                    LeadRequirement.status.in_(["active", "matched"]),
                )
            )
        ).scalars().all()
        for lr in linked:
            lr.status = "closed"
            await _close_open_matches_for_requirement(db, lr.id)

    demand_name = demand.contact.name if demand and demand.contact else "Renter/buyer"
    supply_label = (
        listing.title
        if listing
        else (
            f"{supply.contact.name}'s property"
            if supply and supply.contact
            else "property"
        )
    )
    summary = f"Closed: {demand_name} ← {supply_label}"
    if notes:
        summary = f"{summary}. {notes}"
    if commission_amount is not None:
        summary = f"{summary}. Commission: {commission_amount:g}"
        if commission_received:
            summary = f"{summary} (received)"

    deal = Deal(
        stream_type=stream,
        stage="closed",
        contact_id=contact_id,
        listing_id=listing.id if listing else None,
        requirement_id=demand.id if demand else (req.id if req else None),
        requirement_summary=summary,
        assigned_user_id=user_id,
        commission_amount=commission_amount,
        commission_received=commission_received,
    )
    db.add(deal)

    for cid, text in [
        (
            demand.contact_id if demand else None,
            f"Deal done — moved into {supply_label}"
            + (
                f". Commission ₹{commission_amount:g}"
                + (" received" if commission_received else " pending")
                if commission_amount is not None
                else ""
            ),
        ),
        (supply.contact_id if supply else None, f"Deal closed — {demand_name} took this property"),
    ]:
        if cid:
            db.add(
                Activity(
                    contact_id=cid,
                    activity_type="status_change",
                    content=text,
                    created_by_id=user_id,
                )
            )

    if demand and demand.contact and commission_received:
        demand.contact.lead_score = demand.contact.lead_score or "hot"

    await db.commit()
    await db.refresh(deal)
    return deal
