from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.inventory import Location, Project, UnitOption, UnitSpec
from app.models.user import User
from app.schemas import (
    LocationCreate,
    LocationResponse,
    NearbyRequest,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    SpecDetailResponse,
    UnitOptionCreate,
    UnitOptionResponse,
    UnitSpecCreate,
    UnitSpecResponse,
)
from app.services.matching import match_all_active

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _haversine_km(lat1: float, lon1: float, lat2, lon2):
    """Haversine distance in km — works without PostGIS."""
    return (
        6371
        * func.acos(
            func.least(
                1.0,
                func.cos(func.radians(lat1))
                * func.cos(func.radians(lat2))
                * func.cos(func.radians(lon2) - func.radians(lon1))
                + func.sin(func.radians(lat1))
                * func.sin(func.radians(lat2)),
            )
        )
    )


@router.get("/locations", response_model=list[LocationResponse])
async def list_locations(
    q: str | None = None,
    city: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Location)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Location.area.ilike(pattern), Location.city.ilike(pattern), Location.pin_code.ilike(pattern)))
    if city:
        stmt = stmt.where(Location.city.ilike(f"%{city}%"))
    stmt = stmt.order_by(Location.area).limit(50)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/locations", response_model=LocationResponse)
async def create_location(
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    location = Location(**body.model_dump())
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.post("/locations/nearby", response_model=list[LocationResponse])
async def nearby_locations(
    body: NearbyRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    distance = _haversine_km(body.latitude, body.longitude, Location.latitude, Location.longitude)
    stmt = (
        select(Location)
        .where(Location.latitude.isnot(None), Location.longitude.isnot(None))
        .where(distance <= body.radius_km)
        .order_by(distance)
        .limit(30)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    location_id: UUID | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Project)
    if location_id:
        stmt = stmt.where(Project.location_id == location_id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Project.name.ilike(pattern), Project.builder_name.ilike(pattern)))
    stmt = stmt.order_by(Project.name).limit(50)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.location), selectinload(Project.options))
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return ProjectDetailResponse(
        **ProjectResponse.model_validate(project).model_dump(),
        location=LocationResponse.model_validate(project.location) if project.location else None,
        options=[UnitOptionResponse.model_validate(o) for o in project.options],
    )


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    project = Project(**body.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    for key, value in body.model_dump().items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/options", response_model=list[UnitOptionResponse])
async def list_options(
    project_id: UUID,
    stream_type: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(UnitOption).where(UnitOption.project_id == project_id)
    if stream_type:
        stmt = stmt.where(UnitOption.stream_type == stream_type)
    if q:
        stmt = stmt.where(UnitOption.configuration.ilike(f"%{q}%"))
    stmt = stmt.order_by(UnitOption.configuration)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/options", response_model=UnitOptionResponse)
async def create_option(
    body: UnitOptionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    option = UnitOption(**body.model_dump())
    db.add(option)
    await db.commit()
    await db.refresh(option)
    return option


@router.get("/specs", response_model=list[UnitSpecResponse])
async def list_specs(
    option_id: UUID,
    stream_type: str | None = None,
    status: str | None = Query(default="available"),
    min_price: float | None = None,
    max_price: float | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(UnitSpec).where(UnitSpec.option_id == option_id)
    if stream_type:
        stmt = stmt.where(UnitSpec.stream_type == stream_type)
    if status:
        stmt = stmt.where(UnitSpec.status == status)
    if stream_type == "rental" or (stream_type is None):
        if min_price is not None:
            stmt = stmt.where(or_(UnitSpec.rent_price >= min_price, UnitSpec.sale_price >= min_price))
        if max_price is not None:
            stmt = stmt.where(or_(UnitSpec.rent_price <= max_price, UnitSpec.sale_price <= max_price))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/specs/{spec_id}", response_model=SpecDetailResponse)
async def get_spec(
    spec_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(UnitSpec)
        .where(UnitSpec.id == spec_id)
        .options(selectinload(UnitSpec.option).selectinload(UnitOption.project).selectinload(Project.location))
    )
    result = await db.execute(stmt)
    spec = result.scalar_one_or_none()
    if not spec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Spec not found")
    option = spec.option
    project = option.project if option else None
    location = project.location if project else None
    return SpecDetailResponse(
        **UnitSpecResponse.model_validate(spec).model_dump(),
        option=UnitOptionResponse.model_validate(option) if option else None,
        project=ProjectResponse.model_validate(project) if project else None,
        location=LocationResponse.model_validate(location) if location else None,
    )


@router.post("/specs", response_model=UnitSpecResponse)
async def create_spec(
    body: UnitSpecCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    spec = UnitSpec(**body.model_dump())
    db.add(spec)
    await db.commit()
    await db.refresh(spec)
    if spec.status == "available":
        await match_all_active(db)
    return spec
