from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.contact import Contact, Deal
from app.models.inventory import Location, Project, UnitOption, UnitSpec
from app.models.user import User
from app.schemas import SearchResult

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=list[SearchResult])
async def global_search(
    q: str = Query(min_length=1),
    entity: str | None = None,
    stream_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pattern = f"%{q}%"
    results: list[SearchResult] = []

    if entity in (None, "contact"):
        contact_stmt = select(Contact).where(
            or_(Contact.name.ilike(pattern), Contact.phone.ilike(pattern), Contact.email.ilike(pattern))
        )
        if stream_type:
            contact_stmt = contact_stmt.where(Contact.stream_type == stream_type)
        contacts = (await db.execute(contact_stmt.limit(10))).scalars().all()
        for c in contacts:
            results.append(
                SearchResult(
                    entity_type="contact",
                    id=c.id,
                    title=c.name,
                    subtitle=c.phone,
                    meta={"roles": c.roles, "stream_type": c.stream_type},
                )
            )

    if entity in (None, "location"):
        locations = (
            await db.execute(
                select(Location)
                .where(or_(Location.area.ilike(pattern), Location.city.ilike(pattern)))
                .limit(10)
            )
        ).scalars().all()
        for loc in locations:
            results.append(
                SearchResult(
                    entity_type="location",
                    id=loc.id,
                    title=loc.area,
                    subtitle=f"{loc.city} {loc.pin_code or ''}".strip(),
                )
            )

    if entity in (None, "project"):
        projects = (
            await db.execute(
                select(Project)
                .where(or_(Project.name.ilike(pattern), Project.builder_name.ilike(pattern)))
                .limit(10)
            )
        ).scalars().all()
        for p in projects:
            results.append(
                SearchResult(
                    entity_type="project",
                    id=p.id,
                    title=p.name,
                    subtitle=p.builder_name,
                )
            )

    if entity in (None, "spec"):
        spec_stmt = (
            select(UnitSpec, UnitOption, Project)
            .join(UnitOption, UnitSpec.option_id == UnitOption.id)
            .join(Project, UnitOption.project_id == Project.id)
            .where(
                or_(
                    UnitOption.configuration.ilike(pattern),
                    Project.name.ilike(pattern),
                    UnitSpec.unit_number.ilike(pattern),
                )
            )
        )
        if stream_type:
            spec_stmt = spec_stmt.where(UnitSpec.stream_type == stream_type)
        rows = (await db.execute(spec_stmt.limit(10))).all()
        for spec, option, project in rows:
            price = spec.sale_price or spec.rent_price
            results.append(
                SearchResult(
                    entity_type="spec",
                    id=spec.id,
                    title=f"{project.name} — {option.configuration}",
                    subtitle=f"{spec.carpet_sqft or '-'} sqft · {price or '-'}",
                    meta={"project_id": str(project.id), "option_id": str(option.id)},
                )
            )

    if entity in (None, "deal"):
        deals = (
            await db.execute(select(Deal).where(Deal.requirement_summary.ilike(pattern)).limit(10))
        ).scalars().all()
        for d in deals:
            results.append(
                SearchResult(
                    entity_type="deal",
                    id=d.id,
                    title=f"Deal ({d.stream_type})",
                    subtitle=d.stage,
                    meta={"contact_id": str(d.contact_id)},
                )
            )

    return results
