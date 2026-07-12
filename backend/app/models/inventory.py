from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    area: Mapped[str] = mapped_column(String(255), index=True)
    city: Mapped[str] = mapped_column(String(255), index=True)
    state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    google_place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    projects: Mapped[list["Project"]] = relationship(back_populates="location", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    builder_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    rera_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    possession_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    possession_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amenities: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    brochure_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    google_place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_fields: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_draft: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location: Mapped["Location"] = relationship(back_populates="projects")
    options: Mapped[list["UnitOption"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class UnitOption(Base):
    __tablename__ = "unit_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    configuration: Mapped[str] = mapped_column(String(64), index=True)
    tower: Mapped[str | None] = mapped_column(String(64), nullable=True)
    availability_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stream_type: Mapped[str] = mapped_column(String(16), default="sales")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="options")
    specs: Mapped[list["UnitSpec"]] = relationship(back_populates="option", cascade="all, delete-orphan")


class UnitSpec(Base):
    __tablename__ = "unit_specs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    option_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("unit_options.id"), index=True)
    carpet_sqft: Mapped[float | None] = mapped_column(Float, nullable=True)
    built_up_sqft: Mapped[float | None] = mapped_column(Float, nullable=True)
    super_built_up_sqft: Mapped[float | None] = mapped_column(Float, nullable=True)
    sale_price: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    rent_price: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    floor: Mapped[str | None] = mapped_column(String(32), nullable=True)
    facing: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parking: Mapped[str | None] = mapped_column(String(64), nullable=True)
    furnishing: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="available", index=True)
    stream_type: Mapped[str] = mapped_column(String(16), default="sales")
    unit_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    option: Mapped["UnitOption"] = relationship(back_populates="specs")
