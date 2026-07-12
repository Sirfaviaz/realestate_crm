from datetime import UTC, datetime, timedelta
from uuid import UUID
import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact
from app.models.inventory import Project, UnitOption, UnitSpec
from app.models.listing import Listing
from app.models.requirement import LeadRequirement, RequirementMatch

logger = logging.getLogger(__name__)


def _contact_dict(c: Contact) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "phone": c.phone,
        "whatsapp": c.whatsapp or c.phone,
        "roles": c.roles,
        "lead_score": c.lead_score,
        "urgency": c.urgency,
        "follow_up_at": c.follow_up_at.isoformat() if c.follow_up_at else None,
        "site_visit_at": c.site_visit_at.isoformat() if c.site_visit_at else None,
        "site_visit_location": c.site_visit_location,
    }


def _match_dict(m: RequirementMatch) -> dict:
    info = {"title": None, "location": None, "bhk": None, "price": None, "property_type": None}
    contact = None
    matched_role = None
    if m.matched_requirement and m.matched_requirement.contact:
        other = m.matched_requirement
        c = other.contact
        locs = other.preferred_locations or []
        location = ", ".join(locs) if locs else other.city
        price = other.rent_budget if other.stream_type == "rental" else (other.budget_max or other.budget_min)
        if other.role in ("landlord", "seller"):
            title = f"{c.name}'s property"
        else:
            title = f"{c.name} looking for {other.bhk or 'property'}"
        info = {
            "title": title,
            "location": location,
            "bhk": other.bhk,
            "price": price,
            "property_type": (other.property_types or [None])[0],
        }
        contact = c
        matched_role = other.role
    elif m.listing:
        info = {
            "title": m.listing.title,
            "location": m.listing.location_text,
            "bhk": m.listing.bhk,
            "price": m.listing.price,
            "property_type": m.listing.property_type,
        }
        contact = m.listing.contact
    elif m.spec and m.spec.option:
        spec = m.spec
        opt = spec.option
        proj = opt.project
        loc = proj.location if proj else None
        info = {
            "title": proj.name if proj else "Unit",
            "location": f"{loc.area}, {loc.city}" if loc else None,
            "bhk": opt.configuration,
            "price": spec.rent_price or spec.sale_price,
        }
    if contact is None and m.requirement:
        contact = m.requirement.contact
    return {
        "id": str(m.id),
        "requirement_id": str(m.requirement_id),
        "status": m.status,
        "match_score": m.match_score,
        "contact_name": contact.name if contact else None,
        "contact_phone": contact.phone if contact else None,
        "contact_whatsapp": (contact.whatsapp or contact.phone) if contact else None,
        "requirement_role": m.requirement.role if m.requirement else None,
        "matched_role": matched_role,
        **info,
    }


async def get_dashboard(db: AsyncSession, user_id: UUID | None = None) -> dict:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    soon = now + timedelta(hours=24)

    def scoped():
        stmt = select(Contact)
        if user_id:
            stmt = stmt.where(Contact.assigned_user_id == user_id)
        return stmt

    overdue = (
        await db.execute(
            scoped().where(Contact.follow_up_at.isnot(None), Contact.follow_up_at < now)
            .order_by(Contact.follow_up_at).limit(20)
        )
    ).scalars().all()

    follow_ups_due = (
        await db.execute(
            scoped().where(
                Contact.follow_up_at.isnot(None),
                Contact.follow_up_at >= now,
                Contact.follow_up_at <= soon,
            ).order_by(Contact.follow_up_at).limit(20)
        )
    ).scalars().all()

    site_visits = (
        await db.execute(
            scoped().where(
                Contact.site_visit_at.isnot(None),
                Contact.site_visit_at >= today_start,
                Contact.site_visit_at < today_end,
            ).order_by(Contact.site_visit_at).limit(20)
        )
    ).scalars().all()

    hot_leads = (
        await db.execute(
            scoped().where(Contact.lead_score == "hot").order_by(Contact.updated_at.desc()).limit(20)
        )
    ).scalars().all()

    matches_to_inform: list = []
    try:
        match_stmt = (
            select(RequirementMatch)
            .options(
                selectinload(RequirementMatch.listing).selectinload(Listing.contact),
                selectinload(RequirementMatch.spec)
                .selectinload(UnitSpec.option)
                .selectinload(UnitOption.project)
                .selectinload(Project.location),
                selectinload(RequirementMatch.requirement).selectinload(LeadRequirement.contact),
                selectinload(RequirementMatch.matched_requirement).selectinload(LeadRequirement.contact),
            )
            .where(RequirementMatch.status == "new")
            .order_by(RequirementMatch.created_at.desc())
            .limit(20)
        )
        if user_id:
            # Explicit ON clause — requirement_matches has two FKs to lead_requirements.
            match_stmt = match_stmt.join(
                LeadRequirement,
                RequirementMatch.requirement_id == LeadRequirement.id,
            ).where(LeadRequirement.assigned_user_id == user_id)
        matches_to_inform = list((await db.execute(match_stmt)).scalars().all())
    except Exception as exc:
        # Missing migration columns or stale schema should not take down the whole Today page.
        logger.warning("Dashboard matches query failed: %s", exc)
        await db.rollback()
        matches_to_inform = []

    role_counts: dict[str, int] = {}
    for role, aliases in [
        ("buyer", ["buyer"]),
        ("seller", ["seller"]),
        ("renter", ["renter", "lessee"]),
        ("landlord", ["landlord", "lessor"]),
    ]:
        stmt = scoped().where(or_(*[Contact.roles.contains([a]) for a in aliases]))
        role_counts[role] = len((await db.execute(stmt)).scalars().all())

    return {
        "overdue": [_contact_dict(c) for c in overdue],
        "follow_ups_due": [_contact_dict(c) for c in follow_ups_due],
        "site_visits_today": [_contact_dict(c) for c in site_visits],
        "hot_leads": [_contact_dict(c) for c in hot_leads],
        "matches_to_inform": [_match_dict(m) for m in matches_to_inform],
        "role_counts": role_counts,
    }
