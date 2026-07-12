from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.contact import Activity, Contact
from app.models.enums import UserRole
from app.models.inventory import Project, UnitOption, UnitSpec
from app.models.listing import Listing
from app.models.requirement import LeadRequirement, RequirementMatch
from app.models.user import User
from app.schemas import (
    InformMatchRequest,
    LeadRequirementCreate,
    LeadRequirementResponse,
    MatchFollowUpRequest,
    MatchStatusUpdate,
    RequirementMatchResponse,
)
from app.services.matching import find_available_properties, match_requirement

router = APIRouter(prefix="/requirements", tags=["requirements"])
matches_router = APIRouter(prefix="/matches", tags=["matches"])

_MATCH_LOAD = (
    selectinload(RequirementMatch.listing).selectinload(Listing.media),
    selectinload(RequirementMatch.listing).selectinload(Listing.contact),
    selectinload(RequirementMatch.spec)
    .selectinload(UnitSpec.option)
    .selectinload(UnitOption.project)
    .selectinload(Project.location),
    selectinload(RequirementMatch.requirement).selectinload(LeadRequirement.contact),
    selectinload(RequirementMatch.matched_requirement).selectinload(LeadRequirement.contact),
)


def _req_response(req: LeadRequirement) -> LeadRequirementResponse:
    data = LeadRequirementResponse.model_validate(req)
    if req.contact:
        data.contact_name = req.contact.name
        data.contact_phone = req.contact.phone
        data.contact_whatsapp = req.contact.whatsapp or req.contact.phone
        data.tenant_type = req.contact.tenant_type
        data.occupant_count = req.contact.occupant_count
        data.profession = req.contact.profession
        data.workplace_text = req.contact.workplace_text
    data.match_count = len(req.matches) if req.matches else 0
    data.new_match_count = sum(1 for m in (req.matches or []) if m.status == "new")
    return data


def _match_property_info(match: RequirementMatch) -> dict:
    info: dict = {
        "title": None,
        "location": None,
        "bhk": None,
        "price": None,
        "property_type": None,
        "cover_url": None,
        "matched_role": None,
    }
    if match.matched_requirement and match.matched_requirement.contact:
        other = match.matched_requirement
        c = other.contact
        locs = other.preferred_locations or []
        location = ", ".join(locs) if locs else other.city
        price = other.rent_budget if other.stream_type == "rental" else (other.budget_max or other.budget_min)
        if other.role in ("landlord", "seller"):
            title = f"{c.name}'s property"
        else:
            title = f"{c.name} looking for {other.bhk or 'property'}"
        info.update(
            title=title,
            location=location,
            bhk=other.bhk,
            price=price,
            property_type=(other.property_types or [None])[0],
            matched_role=other.role,
        )
        return info
    if match.listing:
        l = match.listing
        info.update(
            title=l.title,
            location=l.location_text,
            bhk=l.bhk,
            price=l.price,
            property_type=l.property_type,
            cover_url=f"/listings/media/{l.media[0].file_path}" if l.media else None,
        )
    elif match.spec and match.spec.option:
        spec = match.spec
        opt = spec.option
        proj = opt.project
        loc = proj.location if proj else None
        info.update(
            title=proj.name if proj else "Unit",
            location=f"{loc.area}, {loc.city}" if loc else None,
            bhk=opt.configuration,
            price=spec.rent_price or spec.sale_price,
        )
    return info


def _match_response(match: RequirementMatch) -> RequirementMatchResponse:
    data = RequirementMatchResponse.model_validate(match)
    info = _match_property_info(match)
    for k, v in info.items():
        setattr(data, k, v)
    # Contact to inform = counterpart lead (or listing owner), not always the parent requirement.
    if match.matched_requirement and match.matched_requirement.contact:
        c = match.matched_requirement.contact
        data.contact_name = c.name
        data.contact_phone = c.phone
        data.contact_whatsapp = c.whatsapp or c.phone
    elif match.listing and match.listing.contact:
        c = match.listing.contact
        data.contact_name = c.name
        data.contact_phone = c.phone
        data.contact_whatsapp = c.whatsapp or c.phone
    elif match.requirement and match.requirement.contact:
        c = match.requirement.contact
        data.contact_name = c.name
        data.contact_phone = c.phone
        data.contact_whatsapp = c.whatsapp or c.phone
    if match.requirement:
        data.requirement_role = match.requirement.role
    return data


@router.get("", response_model=list[LeadRequirementResponse])
async def list_requirements(
    role: str | None = None,
    status: str | None = None,
    contact_id: UUID | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(LeadRequirement)
        .options(selectinload(LeadRequirement.contact), selectinload(LeadRequirement.matches))
        .order_by(LeadRequirement.updated_at.desc())
    )
    if role:
        stmt = stmt.where(LeadRequirement.role == role)
    if status:
        stmt = stmt.where(LeadRequirement.status == status)
    if contact_id:
        stmt = stmt.where(LeadRequirement.contact_id == contact_id)
    result = await db.execute(stmt.limit(100))
    reqs = result.scalars().all()
    if q:
        ql = q.lower()
        reqs = [
            r for r in reqs
            if ql in r.contact.name.lower() or ql in r.contact.phone
            or any(ql in (loc or "").lower() for loc in (r.preferred_locations or []))
        ]
    return [_req_response(r) for r in reqs]


@router.post("", response_model=LeadRequirementResponse)
async def create_requirement(
    body: LeadRequirementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    contact_result = await db.execute(select(Contact).where(Contact.id == body.contact_id))
    if not contact_result.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    data = body.model_dump()
    if data.get("location_anchors"):
        data["location_anchors"] = [a.model_dump() if hasattr(a, "model_dump") else a for a in data["location_anchors"]]
    if not data.get("assigned_user_id"):
        data["assigned_user_id"] = user.id
    req = LeadRequirement(**data)
    db.add(req)
    await db.commit()
    await db.refresh(req)
    await match_requirement(db, req.id)
    result = await db.execute(
        select(LeadRequirement)
        .options(selectinload(LeadRequirement.contact), selectinload(LeadRequirement.matches))
        .where(LeadRequirement.id == req.id)
    )
    return _req_response(result.scalar_one())


@router.get("/{requirement_id}", response_model=LeadRequirementResponse)
async def get_requirement(
    requirement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LeadRequirement)
        .options(selectinload(LeadRequirement.contact), selectinload(LeadRequirement.matches))
        .where(LeadRequirement.id == requirement_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requirement not found")
    return _req_response(req)


@router.patch("/{requirement_id}", response_model=LeadRequirementResponse)
async def update_requirement(
    requirement_id: UUID,
    body: LeadRequirementCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(
        select(LeadRequirement)
        .options(selectinload(LeadRequirement.contact), selectinload(LeadRequirement.matches))
        .where(LeadRequirement.id == requirement_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requirement not found")
    for key, value in body.model_dump(exclude={"contact_id"}).items():
        setattr(req, key, value)
    await db.commit()
    await match_requirement(db, req.id)
    await db.refresh(req)
    return _req_response(req)


@router.post("/{requirement_id}/find-matches")
async def find_matches(
    requirement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    count = await match_requirement(db, requirement_id)
    return {"matches_found": count}


@router.get("/{requirement_id}/available-now")
async def available_now(
    requirement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(LeadRequirement).where(LeadRequirement.id == requirement_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requirement not found")
    return await find_available_properties(db, requirement_id)


@router.get("/{requirement_id}/matches", response_model=list[RequirementMatchResponse])
async def list_matches(
    requirement_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RequirementMatch)
        .options(*_MATCH_LOAD)
        .where(RequirementMatch.requirement_id == requirement_id)
        .order_by(RequirementMatch.match_score.desc().nullslast(), RequirementMatch.created_at.desc())
    )
    return [_match_response(m) for m in result.scalars().all()]


@router.post("/{requirement_id}/matches/{match_id}/inform", response_model=RequirementMatchResponse)
async def inform_match(
    requirement_id: UUID,
    match_id: UUID,
    body: InformMatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(
        select(RequirementMatch)
        .options(*_MATCH_LOAD)
        .where(RequirementMatch.id == match_id, RequirementMatch.requirement_id == requirement_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    via = body.via
    if via not in ("call", "whatsapp"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "via must be call or whatsapp")
    match.status = f"informed_{via}"
    match.informed_at = datetime.now(UTC)
    match.informed_via = via
    if body.notes:
        match.notes = body.notes
    contact = match.requirement.contact if match.requirement else None
    info = _match_property_info(match)
    db.add(
        Activity(
            contact_id=contact.id if contact else None,
            activity_type="match_informed",
            content=f"Informed via {via}: {info.get('title') or 'property'}",
            created_by_id=user.id,
        )
    )
    await db.commit()
    await db.refresh(match)
    return _match_response(match)


@router.post("/{requirement_id}/matches/{match_id}/follow-up", response_model=RequirementMatchResponse)
async def match_follow_up(
    requirement_id: UUID,
    match_id: UUID,
    body: MatchFollowUpRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(
        select(RequirementMatch)
        .options(*_MATCH_LOAD)
        .where(RequirementMatch.id == match_id, RequirementMatch.requirement_id == requirement_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    match.follow_up_at = body.follow_up_at
    match.status = "follow_up"
    if body.notes:
        match.notes = body.notes
    contact = match.requirement.contact if match.requirement else None
    db.add(
        Activity(
            contact_id=contact.id if contact else None,
            activity_type="match_follow_up",
            content=f"Follow-up scheduled for match: {info if (info := _match_property_info(match).get('title')) else 'property'}",
            created_by_id=user.id,
        )
    )
    await db.commit()
    await db.refresh(match)
    return _match_response(match)


@router.patch("/{requirement_id}/matches/{match_id}", response_model=RequirementMatchResponse)
async def update_match_status(
    requirement_id: UUID,
    match_id: UUID,
    body: MatchStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(
        select(RequirementMatch)
        .options(*_MATCH_LOAD)
        .where(RequirementMatch.id == match_id, RequirementMatch.requirement_id == requirement_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    match.status = body.status
    if body.notes:
        match.notes = body.notes
    await db.commit()
    await db.refresh(match)
    return _match_response(match)


@matches_router.get("/pending", response_model=list[RequirementMatchResponse])
async def pending_matches(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(RequirementMatch)
        .options(*_MATCH_LOAD)
        .where(RequirementMatch.status == "new")
        .order_by(RequirementMatch.created_at.desc())
        .limit(50)
    )
    if user.role != UserRole.ADMIN.value:
        stmt = stmt.join(
            LeadRequirement,
            RequirementMatch.requirement_id == LeadRequirement.id,
        ).where(LeadRequirement.assigned_user_id == user.id)
    result = await db.execute(stmt)
    return [_match_response(m) for m in result.scalars().all()]
