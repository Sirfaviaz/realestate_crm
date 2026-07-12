from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LeadRequirement(Base):
    __tablename__ = "lead_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), index=True)
    stream_type: Mapped[str] = mapped_column(String(16), index=True)
    property_types: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    preferred_locations: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    location_anchors: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    search_radius_km: Mapped[float | None] = mapped_column(Float, nullable=True, default=5.0)
    bhk: Mapped[str | None] = mapped_column(String(32), nullable=True)
    budget_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    rent_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    security_deposit: Mapped[float | None] = mapped_column(Float, nullable=True)
    maintenance: Mapped[float | None] = mapped_column(Float, nullable=True)
    move_in_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    urgency: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lead_score: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_tenant_types: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True, index=True
    )
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contact: Mapped["Contact"] = relationship(back_populates="requirements")
    matches: Mapped[list["RequirementMatch"]] = relationship(
        back_populates="requirement",
        cascade="all, delete-orphan",
        foreign_keys="RequirementMatch.requirement_id",
    )


class RequirementMatch(Base):
    __tablename__ = "requirement_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lead_requirements.id"), index=True
    )
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True, index=True
    )
    spec_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unit_specs.id"), nullable=True, index=True
    )
    matched_requirement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lead_requirements.id"), nullable=True, index=True
    )
    match_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    informed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    informed_via: Mapped[str | None] = mapped_column(String(32), nullable=True)
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    requirement: Mapped["LeadRequirement"] = relationship(
        back_populates="matches", foreign_keys=[requirement_id]
    )
    matched_requirement: Mapped["LeadRequirement | None"] = relationship(
        foreign_keys=[matched_requirement_id]
    )
    listing: Mapped["Listing | None"] = relationship()
    spec: Mapped["UnitSpec | None"] = relationship()
