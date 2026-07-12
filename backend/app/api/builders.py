from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.builder import Builder, BuilderProject, BuilderSubmission
from app.models.contact import Activity, Deal
from app.models.enums import UserRole
from app.models.inventory import Project, UnitOption, UnitSpec
from app.models.user import User
from app.schemas import (
    BuilderCreate,
    BuilderResponse,
    BuilderSubmissionCreate,
    BuilderSubmissionResponse,
    BuilderSubmissionUpdate,
)
from app.services.email import format_builder_lead_email, send_email

router = APIRouter(prefix="/builders", tags=["builders"])


async def _builder_response(db: AsyncSession, builder: Builder) -> BuilderResponse:
    links = await db.execute(select(BuilderProject.project_id).where(BuilderProject.builder_id == builder.id))
    project_ids = [row[0] for row in links.all()]
    return BuilderResponse(
        id=builder.id,
        name=builder.name,
        email=builder.email,
        phone=builder.phone,
        is_active=builder.is_active,
        project_ids=project_ids,
    )


@router.get("", response_model=list[BuilderResponse])
async def list_builders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Builder).where(Builder.is_active.is_(True)).order_by(Builder.name))
    builders = result.scalars().all()
    return [await _builder_response(db, b) for b in builders]


@router.post("", response_model=BuilderResponse)
async def create_builder(
    body: BuilderCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    builder = Builder(name=body.name, email=body.email, phone=body.phone)
    db.add(builder)
    await db.flush()
    for project_id in body.project_ids:
        db.add(BuilderProject(builder_id=builder.id, project_id=project_id))
    await db.commit()
    await db.refresh(builder)
    return await _builder_response(db, builder)


@router.post("/submissions", response_model=BuilderSubmissionResponse)
async def send_to_builder(
    body: BuilderSubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    if not body.consent_given:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Contact consent required")

    deal_result = await db.execute(
        select(Deal).where(Deal.id == body.deal_id).options(selectinload(Deal.contact))
    )
    deal = deal_result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deal not found")

    builder_result = await db.execute(select(Builder).where(Builder.id == body.builder_id))
    builder = builder_result.scalar_one_or_none()
    if not builder:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Builder not found")

    snapshot: dict = {
        "contact_name": deal.contact.name if deal.contact else None,
        "contact_phone": deal.contact.phone if deal.contact else None,
        "contact_email": deal.contact.email if deal.contact else None,
        "requirement_summary": deal.requirement_summary,
        "notes": deal.contact.notes if deal.contact else None,
    }

    if deal.spec_id:
        spec_result = await db.execute(
            select(UnitSpec)
            .where(UnitSpec.id == deal.spec_id)
            .options(selectinload(UnitSpec.option).selectinload(UnitOption.project).selectinload(Project.location))
        )
        spec = spec_result.scalar_one_or_none()
        if spec and spec.option and spec.option.project:
            project = spec.option.project
            snapshot.update(
                {
                    "location_name": project.location.area if project.location else None,
                    "project_name": project.name,
                    "configuration": spec.option.configuration,
                    "sqft": spec.carpet_sqft or spec.built_up_sqft,
                    "price": spec.sale_price or spec.rent_price,
                }
            )

    subject, email_body = format_builder_lead_email(snapshot, user.name, user.phone)
    await send_email(builder.email, subject, email_body)

    submission = BuilderSubmission(
        deal_id=deal.id,
        builder_id=builder.id,
        status="sent",
        snapshot=snapshot,
        email_sent_at=datetime.now(UTC),
        sent_by_id=user.id,
    )
    db.add(submission)
    db.add(
        Activity(
            deal_id=deal.id,
            contact_id=deal.contact_id,
            activity_type="builder_sent",
            content=f"Lead sent to {builder.name}",
            created_by_id=user.id,
        )
    )
    await db.commit()
    await db.refresh(submission)
    return submission


@router.get("/submissions", response_model=list[BuilderSubmissionResponse])
async def list_submissions(
    builder_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(BuilderSubmission).order_by(BuilderSubmission.created_at.desc())
    if builder_id:
        stmt = stmt.where(BuilderSubmission.builder_id == builder_id)
    result = await db.execute(stmt.limit(100))
    return result.scalars().all()


@router.patch("/submissions/{submission_id}", response_model=BuilderSubmissionResponse)
async def update_submission(
    submission_id: UUID,
    body: BuilderSubmissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(BuilderSubmission).where(BuilderSubmission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")

    submission.status = body.status
    if body.notes:
        submission.notes = body.notes
    if body.status == "acknowledged":
        submission.acknowledged_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(submission)
    return submission
