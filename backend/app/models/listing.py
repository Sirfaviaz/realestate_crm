from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True, index=True
    )
    spec_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("unit_specs.id"), nullable=True, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True
    )
    stream_type: Mapped[str] = mapped_column(String(16), index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    location_text: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    bhk: Mapped[str | None] = mapped_column(String(32), nullable=True)
    property_type: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    sqft: Mapped[float | None] = mapped_column(Float, nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True, index=True)
    builder_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    project_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    land_area_cent: Mapped[float | None] = mapped_column(Float, nullable=True)
    launching_time: Mapped[str | None] = mapped_column(String(128), nullable=True)
    completion_time: Mapped[str | None] = mapped_column(String(128), nullable=True)
    total_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parking_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    available_floors: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amenities: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    base_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    car_parking_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    gst_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    down_payment_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    utility_charge: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_instalment: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_as_of_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_rent: Mapped[float | None] = mapped_column(Float, nullable=True)
    security_deposit: Mapped[float | None] = mapped_column(Float, nullable=True)
    maintenance: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="available", index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contact: Mapped["Contact | None"] = relationship(back_populates="listings")
    media: Mapped[list["ListingMedia"]] = relationship(
        back_populates="listing", cascade="all, delete-orphan", order_by="ListingMedia.sort_order"
    )


class ListingMedia(Base):
    __tablename__ = "listing_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("listings.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(512))
    media_type: Mapped[str] = mapped_column(String(16))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing: Mapped["Listing"] = relationship(back_populates="media")
