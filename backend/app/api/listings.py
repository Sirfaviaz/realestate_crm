from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.contact import Contact
from app.models.enums import UserRole
from app.models.listing import Listing, ListingMedia
from app.models.user import User
from app.schemas import ListingCreate, ListingMediaResponse, ListingResponse
from app.services.matching import match_all_active
from app.services.listing_sync import sync_listings_from_supply_leads
from app.services.storage import resolve_media_path, save_upload

router = APIRouter(prefix="/listings", tags=["listings"])


def _listing_url(listing: Listing) -> ListingResponse:
    cover = listing.media[0].file_path if listing.media else None
    data = ListingResponse.model_validate(listing)
    data.cover_url = f"/listings/media/{cover}" if cover else None
    if listing.contact:
        data.contact_name = listing.contact.name
        data.contact_phone = listing.contact.phone
        data.contact_whatsapp = listing.contact.whatsapp or listing.contact.phone
    data.media = [
        ListingMediaResponse(
            id=m.id,
            listing_id=m.listing_id,
            file_path=m.file_path,
            media_type=m.media_type,
            sort_order=m.sort_order,
            url=f"/listings/media/{m.file_path}",
            created_at=m.created_at,
        )
        for m in listing.media
    ]
    return data


@router.post("/sync-from-leads")
async def sync_from_leads(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    """Create/link inventory listings for landlord & seller leads that are missing one."""
    return await sync_listings_from_supply_leads(db)


@router.get("", response_model=list[ListingResponse])
async def list_listings(
    stream_type: str | None = None,
    contact_id: UUID | None = None,
    q: str | None = None,
    bhk: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sync: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if sync:
        await sync_listings_from_supply_leads(db)
    stmt = select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact)).where(Listing.status == "available")
    if stream_type:
        stmt = stmt.where(Listing.stream_type == stream_type)
    if contact_id:
        stmt = stmt.where(Listing.contact_id == contact_id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Listing.title.ilike(pattern), Listing.location_text.ilike(pattern)))
    if bhk:
        stmt = stmt.where(Listing.bhk.ilike(f"%{bhk}%"))
    if min_price is not None:
        stmt = stmt.where(Listing.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.price <= max_price)
    stmt = stmt.order_by(Listing.updated_at.desc()).limit(100)
    result = await db.execute(stmt)
    return [_listing_url(x) for x in result.scalars().all()]


@router.get("/media/{file_path:path}")
async def serve_media(file_path: str):
    path = resolve_media_path(file_path)
    if not path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return FileResponse(path)


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact)).where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    return _listing_url(listing)


@router.post("", response_model=ListingResponse)
async def create_listing(
    body: ListingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    listing = Listing(**body.model_dump(), created_by_id=user.id)
    db.add(listing)
    await db.commit()
    if listing.status == "available":
        await match_all_active(db)
    result = await db.execute(
        select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact)).where(Listing.id == listing.id)
    )
    return _listing_url(result.scalar_one())


@router.post("/{listing_id}/media", response_model=ListingMediaResponse)
async def upload_media(
    listing_id: UUID,
    file: UploadFile = File(...),
    sort_order: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    rel, media_type = await save_upload(file, f"listings/{listing_id}")
    media = ListingMedia(listing_id=listing_id, file_path=rel, media_type=media_type, sort_order=sort_order)
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return ListingMediaResponse(
        id=media.id,
        listing_id=media.listing_id,
        file_path=media.file_path,
        media_type=media.media_type,
        sort_order=media.sort_order,
        url=f"/listings/media/{media.file_path}",
        created_at=media.created_at,
    )


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(select(ListingMedia).where(ListingMedia.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media not found")
    path = resolve_media_path(media.file_path)
    if path:
        path.unlink(missing_ok=True)
    await db.delete(media)
    await db.commit()
