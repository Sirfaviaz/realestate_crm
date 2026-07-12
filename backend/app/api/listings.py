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
from app.models.requirement import LeadRequirement
from app.schemas import ListingCreate, ListingMediaResponse, ListingResponse, ListingUpdate
from app.services.geo import haversine_km
from app.services.matching import match_all_active
from app.services.listing_sync import sync_listings_from_supply_leads
from app.services.storage import resolve_media_path, save_upload

router = APIRouter(prefix="/listings", tags=["listings"])

LISTING_STATUSES = {"available", "unavailable", "hold", "sold", "rented"}


def _listing_url(listing: Listing, *, distance_km: float | None = None) -> ListingResponse:
    cover = listing.media[0].file_path if listing.media else None
    data = ListingResponse.model_validate(listing)
    data.cover_url = f"/listings/media/{cover}" if cover else None
    data.distance_km = round(distance_km, 1) if distance_km is not None else None
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
    listing_status: str | None = Query(
        None,
        alias="status",
        description="available|unavailable|hold|sold|rented|all — default available, or all when contact_id set",
    ),
    q: str | None = None,
    bhk: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    lat: float | None = Query(None, description="Search center latitude for nearby filter"),
    lng: float | None = Query(None, description="Search center longitude for nearby filter"),
    radius_km: float | None = Query(None, ge=0.1, le=100, description="Only listings within this radius of lat/lng"),
    sync: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if sync:
        await sync_listings_from_supply_leads(db)
    nearby = radius_km is not None and lat is not None and lng is not None
    if radius_km is not None and (lat is None or lng is None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "lat and lng are required when using radius_km")

    stmt = select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact))
    status_filter = listing_status
    if status_filter is None:
        status_filter = "all" if contact_id else "available"
    if status_filter != "all":
        statuses = [s.strip() for s in status_filter.split(",") if s.strip()]
        invalid = [s for s in statuses if s not in LISTING_STATUSES]
        if invalid:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid status: {', '.join(invalid)}")
        if len(statuses) == 1:
            stmt = stmt.where(Listing.status == statuses[0])
        else:
            stmt = stmt.where(Listing.status.in_(statuses))
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
    if nearby:
        # Only consider listings with coordinates; coarse bbox then exact haversine.
        # ~1 deg lat ≈ 111 km
        deg = float(radius_km) / 111.0
        stmt = stmt.where(
            Listing.latitude.is_not(None),
            Listing.longitude.is_not(None),
            Listing.latitude.between(lat - deg, lat + deg),
            Listing.longitude.between(lng - deg, lng + deg),
        )
    stmt = stmt.order_by(Listing.updated_at.desc()).limit(300 if nearby else 100)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    if nearby:
        scored: list[tuple[float, Listing]] = []
        for listing in rows:
            if listing.latitude is None or listing.longitude is None:
                continue
            dist = haversine_km(lat, lng, listing.latitude, listing.longitude)
            if dist <= float(radius_km):
                scored.append((dist, listing))
        scored.sort(key=lambda x: x[0])
        return [_listing_url(listing, distance_km=dist) for dist, listing in scored[:100]]

    return [_listing_url(x) for x in rows]


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


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: UUID,
    body: ListingUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(
        select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact)).where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")

    data = body.model_dump(exclude_unset=True)
    new_status = data.get("status")
    if new_status is not None and new_status not in LISTING_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid status: {new_status}")

    for key, value in data.items():
        setattr(listing, key, value)

    if new_status is not None:
        linked = (
            await db.execute(
                select(LeadRequirement).where(
                    LeadRequirement.listing_id == listing.id,
                    LeadRequirement.status.in_(["active", "matched", "paused"]),
                )
            )
        ).scalars().all()
        if new_status == "available":
            for req in linked:
                if req.status == "paused":
                    req.status = "active"
        elif new_status in ("unavailable", "hold"):
            for req in linked:
                if req.status in ("active", "matched"):
                    req.status = "paused"
        elif new_status in ("sold", "rented"):
            for req in linked:
                req.status = "closed"

    await db.commit()
    if new_status == "available":
        await match_all_active(db)

    result = await db.execute(
        select(Listing).options(selectinload(Listing.media), selectinload(Listing.contact)).where(Listing.id == listing_id)
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
