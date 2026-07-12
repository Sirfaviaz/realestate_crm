from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Builder(Base):
    __tablename__ = "builders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project_links: Mapped[list["BuilderProject"]] = relationship(
        back_populates="builder", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["BuilderSubmission"]] = relationship(back_populates="builder")


class BuilderProject(Base):
    __tablename__ = "builder_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    builder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builders.id"), index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)

    builder: Mapped["Builder"] = relationship(back_populates="project_links")


class BuilderSubmission(Base):
    __tablename__ = "builder_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id"), index=True)
    builder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builders.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="sent", index=True)
    snapshot: Mapped[dict] = mapped_column(JSONB)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    deal: Mapped["Deal"] = relationship(back_populates="builder_submissions")
    builder: Mapped["Builder"] = relationship(back_populates="submissions")
