from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.contact import Activity, Contact, Deal
from app.models.whatsapp import WhatsAppMessage
from app.models.user import User
from app.schemas import (
    ActivityCreate,
    ActivityResponse,
    ContactCreate,
    ContactResponse,
    DealCreate,
    DealResponse,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])

# Legacy role values still stored on older records
ROLE_ALIASES: dict[str, list[str]] = {
    "renter": ["renter", "lessee"],
    "landlord": ["landlord", "lessor"],
    "buyer": ["buyer"],
    "seller": ["seller"],
    "lessee": ["lessee", "renter"],
    "lessor": ["lessor", "landlord"],
}


@router.get("", response_model=list[ContactResponse])
async def list_contacts(
    q: str | None = None,
    stream_type: str | None = None,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Contact)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(Contact.name.ilike(pattern), Contact.phone.ilike(pattern), Contact.email.ilike(pattern))
        )
    if stream_type:
        stmt = stmt.where(Contact.stream_type == stream_type)
    if role:
        aliases = ROLE_ALIASES.get(role, [role])
        stmt = stmt.where(or_(*[Contact.roles.contains([a]) for a in aliases]))
    stmt = stmt.order_by(Contact.updated_at.desc()).limit(50)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ContactResponse)
async def create_contact(
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = body.model_dump()
    if not data.get("assigned_user_id"):
        data["assigned_user_id"] = user.id
    contact = Contact(**data)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    for key, value in body.model_dump().items():
        setattr(contact, key, value)
    await db.commit()
    await db.refresh(contact)
    return contact


deals_router = APIRouter(prefix="/deals", tags=["deals"])


@deals_router.get("", response_model=list[DealResponse])
async def list_deals(
    stream_type: str | None = None,
    stage: str | None = None,
    contact_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Deal)
    if stream_type:
        stmt = stmt.where(Deal.stream_type == stream_type)
    if stage:
        stmt = stmt.where(Deal.stage == stage)
    if contact_id:
        stmt = stmt.where(Deal.contact_id == contact_id)
    stmt = stmt.order_by(Deal.updated_at.desc()).limit(50)
    result = await db.execute(stmt)
    return result.scalars().all()


@deals_router.post("", response_model=DealResponse)
async def create_deal(
    body: DealCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deal = Deal(**body.model_dump(), assigned_user_id=user.id)
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return deal


@deals_router.patch("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID,
    body: DealCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deal not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(deal, key, value)
    await db.commit()
    await db.refresh(deal)
    return deal


@router.get("/{contact_id}/whatsapp-messages")
async def list_whatsapp_messages(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.contact_id == contact_id)
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(50)
    )
    return [
        {
            "id": str(m.id),
            "direction": m.direction,
            "phone": m.phone,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in result.scalars().all()
    ]


@router.get("/{contact_id}/activities", response_model=list[ActivityResponse])
async def list_contact_activities(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Activity).where(Activity.contact_id == contact_id).order_by(Activity.created_at.desc())
    )
    return result.scalars().all()


@router.post("/activities", response_model=ActivityResponse)
async def create_activity(
    body: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    activity = Activity(**body.model_dump(), created_by_id=user.id)
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@deals_router.get("/{deal_id}/activities", response_model=list[ActivityResponse])
async def list_deal_activities(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Activity).where(Activity.deal_id == deal_id).order_by(Activity.created_at.desc())
    )
    return result.scalars().all()
