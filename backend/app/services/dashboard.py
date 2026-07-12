from datetime import UTC, datetime, timedelta
from uuid import UUID
import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact, Deal
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
    """Dashboard card: lead to inform + what they matched against."""
    lead = m.requirement.contact if m.requirement else None
    lead_role = m.requirement.role if m.requirement else None
    matched_role = None
    matched_name = None
    info = {"title": None, "location": None, "bhk": None, "price": None, "property_type": None}

    if m.matched_requirement and m.matched_requirement.contact:
        other = m.matched_requirement
        oc = other.contact
        matched_role = other.role
        matched_name = oc.name
        locs = other.preferred_locations or []
        location = ", ".join(locs) if locs else other.city
        price = other.rent_budget if other.stream_type == "rental" else (other.budget_max or other.budget_min)
        types = other.property_types or []
        type_label = types[0] if types else None
        if other.role in ("landlord", "seller"):
            bits = [other.bhk, type_label, location]
            info = {
                "title": f"Property: {' · '.join(str(b) for b in bits if b)}",
                "location": location,
                "bhk": other.bhk,
                "price": price,
                "property_type": type_label,
            }
        else:
            bits = [other.bhk or "property", location]
            info = {
                "title": f"Looking for {' in '.join(str(b) for b in bits if b)}",
                "location": location,
                "bhk": other.bhk,
                "price": price,
                "property_type": type_label,
            }
    elif m.listing:
        info = {
            "title": m.listing.title,
            "location": m.listing.location_text,
            "bhk": m.listing.bhk,
            "price": m.listing.price,
            "property_type": m.listing.property_type,
        }
        matched_name = m.listing.contact.name if m.listing.contact else None
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

    return {
        "id": str(m.id),
        "requirement_id": str(m.requirement_id),
        "status": m.status,
        "match_score": m.match_score,
        "informed_via": m.informed_via,
        "informed_at": m.informed_at.isoformat() if m.informed_at else None,
        "follow_up_at": m.follow_up_at.isoformat() if m.follow_up_at else None,
        "contact_name": lead.name if lead else None,
        "contact_phone": lead.phone if lead else None,
        "contact_whatsapp": (lead.whatsapp or lead.phone) if lead else None,
        "requirement_role": lead_role,
        "matched_role": matched_role,
        "matched_name": matched_name,
        **info,
    }


def _deal_dict(d: Deal) -> dict:
    return {
        "id": str(d.id),
        "stream_type": d.stream_type,
        "stage": d.stage,
        "contact_id": str(d.contact_id),
        "contact_name": d.contact.name if d.contact else None,
        "contact_phone": d.contact.phone if d.contact else None,
        "listing_id": str(d.listing_id) if d.listing_id else None,
        "requirement_id": str(d.requirement_id) if d.requirement_id else None,
        "requirement_summary": d.requirement_summary,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def _match_load():
    return [
        selectinload(RequirementMatch.listing).selectinload(Listing.contact),
        selectinload(RequirementMatch.spec)
        .selectinload(UnitSpec.option)
        .selectinload(UnitOption.project)
        .selectinload(Project.location),
        selectinload(RequirementMatch.requirement).selectinload(LeadRequirement.contact),
        selectinload(RequirementMatch.matched_requirement).selectinload(LeadRequirement.contact),
    ]


async def get_dashboard(db: AsyncSession, user_id: UUID | None = None) -> dict:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    soon = now + timedelta(hours=48)

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
    match_follow_ups: list = []
    try:
        base_opts = _match_load()
        match_stmt = (
            select(RequirementMatch)
            .options(*base_opts)
            .where(RequirementMatch.status == "new")
            .order_by(RequirementMatch.created_at.desc())
            .limit(20)
        )
        fu_stmt = (
            select(RequirementMatch)
            .options(*base_opts)
            .where(
                or_(
                    RequirementMatch.status == "follow_up",
                    RequirementMatch.status.like("informed%"),
                ),
                RequirementMatch.follow_up_at.isnot(None),
            )
            .order_by(RequirementMatch.follow_up_at.asc())
            .limit(30)
        )
        if user_id:
            match_stmt = match_stmt.join(
                LeadRequirement,
                RequirementMatch.requirement_id == LeadRequirement.id,
            ).where(LeadRequirement.assigned_user_id == user_id)
            fu_stmt = fu_stmt.join(
                LeadRequirement,
                RequirementMatch.requirement_id == LeadRequirement.id,
            ).where(LeadRequirement.assigned_user_id == user_id)
        matches_to_inform = list((await db.execute(match_stmt)).scalars().all())
        match_follow_ups = list((await db.execute(fu_stmt)).scalars().all())
    except Exception as exc:
        logger.warning("Dashboard matches query failed: %s", exc)
        await db.rollback()
        matches_to_inform = []
        match_follow_ups = []

    closed_deals: list = []
    try:
        deal_stmt = (
            select(Deal)
            .options(selectinload(Deal.contact))
            .where(Deal.stage == "closed")
            .order_by(Deal.updated_at.desc())
            .limit(30)
        )
        if user_id:
            deal_stmt = deal_stmt.where(Deal.assigned_user_id == user_id)
        closed_deals = list((await db.execute(deal_stmt)).scalars().all())
    except Exception as exc:
        logger.warning("Dashboard closed deals query failed: %s", exc)
        await db.rollback()
        closed_deals = []

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
        "match_follow_ups": [_match_dict(m) for m in match_follow_ups],
        "site_visits_today": [_contact_dict(c) for c in site_visits],
        "hot_leads": [_contact_dict(c) for c in hot_leads],
        "matches_to_inform": [_match_dict(m) for m in matches_to_inform],
        "closed_deals": [_deal_dict(d) for d in closed_deals],
        "role_counts": role_counts,
    }
