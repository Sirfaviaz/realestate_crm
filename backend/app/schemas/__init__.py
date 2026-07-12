from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str | None = None
    role: str = "user"


class UserUpdate(BaseModel):
    is_active: bool | None = None
    name: str | None = None
    phone: str | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    phone: str | None
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    area: str
    city: str
    state: str | None = None
    pin_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    google_place_id: str | None = None


class LocationResponse(LocationCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    location_id: UUID
    name: str
    builder_name: str | None = None
    rera_id: str | None = None
    possession_status: str | None = None
    possession_date: date | None = None
    amenities: list[str] | None = None
    brochure_url: str | None = None
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    google_place_id: str | None = None
    extra_fields: dict | None = None
    is_draft: bool = False


class ProjectResponse(ProjectCreate):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class UnitOptionCreate(BaseModel):
    project_id: UUID
    configuration: str
    tower: str | None = None
    availability_count: int | None = None
    stream_type: str = "sales"


class UnitOptionResponse(UnitOptionCreate):
    id: UUID

    model_config = {"from_attributes": True}


class UnitSpecCreate(BaseModel):
    option_id: UUID
    carpet_sqft: float | None = None
    built_up_sqft: float | None = None
    super_built_up_sqft: float | None = None
    sale_price: float | None = None
    rent_price: float | None = None
    floor: str | None = None
    facing: str | None = None
    parking: str | None = None
    furnishing: str | None = None
    status: str = "available"
    stream_type: str = "sales"
    unit_number: str | None = None
    notes: str | None = None


class UnitSpecResponse(UnitSpecCreate):
    id: UUID

    model_config = {"from_attributes": True}


class ContactCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    whatsapp: str | None = None
    roles: list[str] = Field(default_factory=list)
    stream_type: str = "sales"
    budget_min: float | None = None
    budget_max: float | None = None
    rent_budget: float | None = None
    preferred_locations: list[str] | None = None
    preferred_bhk: str | None = None
    move_in_date: date | None = None
    property_location: str | None = None
    asking_price: float | None = None
    sqft: float | None = None
    timeline_date: date | None = None
    seller_motivation: str | None = None
    urgency: str | None = None
    lead_score: str | None = None
    follow_up_at: datetime | None = None
    site_visit_at: datetime | None = None
    site_visit_location: str | None = None
    notes: str | None = None
    source: str | None = None
    tenant_type: str | None = None
    occupant_count: int | None = None
    profession: str | None = None
    workplace_text: str | None = None
    workplace_lat: float | None = None
    workplace_lng: float | None = None
    assigned_user_id: UUID | None = None


class ContactResponse(ContactCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DealCreate(BaseModel):
    stream_type: str
    contact_id: UUID
    spec_id: UUID | None = None
    stage: str = "new"
    requirement_summary: str | None = None
    follow_up_at: datetime | None = None


class DealResponse(DealCreate):
    id: UUID
    assigned_user_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityCreate(BaseModel):
    deal_id: UUID | None = None
    contact_id: UUID | None = None
    activity_type: str = "note"
    content: str


class ActivityResponse(ActivityCreate):
    id: UUID
    created_by_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BuilderCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    project_ids: list[UUID] = Field(default_factory=list)


class BuilderResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    phone: str | None
    is_active: bool
    project_ids: list[UUID] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BuilderSubmissionCreate(BaseModel):
    deal_id: UUID
    builder_id: UUID
    consent_given: bool = True


class BuilderSubmissionResponse(BaseModel):
    id: UUID
    deal_id: UUID
    builder_id: UUID
    status: str
    snapshot: dict | None = None
    email_sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BuilderSubmissionUpdate(BaseModel):
    status: str
    notes: str | None = None


class SearchResult(BaseModel):
    entity_type: str
    id: UUID
    title: str
    subtitle: str | None = None
    meta: dict | None = None


class NearbyRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 5.0


class ProjectDetailResponse(ProjectResponse):
    location: LocationResponse | None = None
    options: list[UnitOptionResponse] = Field(default_factory=list)


class SpecDetailResponse(UnitSpecResponse):
    option: UnitOptionResponse | None = None
    project: ProjectResponse | None = None
    location: LocationResponse | None = None


class ListingCreate(BaseModel):
    contact_id: UUID | None = None
    spec_id: UUID | None = None
    project_id: UUID | None = None
    stream_type: str
    title: str
    location_text: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    bhk: str | None = None
    property_type: str | None = None
    sqft: float | None = None
    price: float | None = None
    builder_name: str | None = None
    project_name: str | None = None
    land_area_cent: float | None = None
    launching_time: str | None = None
    completion_time: str | None = None
    total_floors: int | None = None
    parking_details: str | None = None
    available_floors: str | None = None
    amenities: list[str] | None = None
    base_price: float | None = None
    car_parking_price: float | None = None
    gst_percent: float | None = None
    down_payment_percent: float | None = None
    utility_charge: float | None = None
    total_instalment: float | None = None
    total_amount: float | None = None
    price_as_of_date: date | None = None
    monthly_rent: float | None = None
    security_deposit: float | None = None
    status: str = "available"
    description: str | None = None


class ListingMediaResponse(BaseModel):
    id: UUID
    listing_id: UUID
    file_path: str
    media_type: str
    sort_order: int
    url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ListingResponse(ListingCreate):
    id: UUID
    cover_url: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None
    media: list[ListingMediaResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportConfirmRequest(BaseModel):
    preview_id: str
    update_duplicates: bool = False


class LocationAnchor(BaseModel):
    name: str
    lat: float
    lng: float
    radius_km: float | None = None


class LeadRequirementCreate(BaseModel):
    contact_id: UUID
    role: str
    stream_type: str
    property_types: list[str] | None = None
    preferred_locations: list[str] | None = None
    location_anchors: list[LocationAnchor] | None = None
    city: str | None = None
    search_radius_km: float | None = 5.0
    bhk: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    rent_budget: float | None = None
    move_in_date: date | None = None
    urgency: str | None = None
    lead_score: str | None = None
    status: str = "active"
    notes: str | None = None
    preferred_tenant_types: list[str] | None = None
    assigned_user_id: UUID | None = None


class LeadRequirementResponse(LeadRequirementCreate):
    id: UUID
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None
    tenant_type: str | None = None
    occupant_count: int | None = None
    profession: str | None = None
    workplace_text: str | None = None
    match_count: int = 0
    new_match_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class RequirementMatchResponse(BaseModel):
    id: UUID
    requirement_id: UUID
    listing_id: UUID | None = None
    spec_id: UUID | None = None
    match_score: int | None = None
    status: str
    informed_at: datetime | None = None
    informed_via: str | None = None
    follow_up_at: datetime | None = None
    notes: str | None = None
    title: str | None = None
    location: str | None = None
    bhk: str | None = None
    price: float | None = None
    property_type: str | None = None
    cover_url: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_whatsapp: str | None = None
    requirement_role: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InformMatchRequest(BaseModel):
    via: str
    notes: str | None = None


class MatchFollowUpRequest(BaseModel):
    follow_up_at: datetime
    notes: str | None = None


class MatchStatusUpdate(BaseModel):
    status: str
    notes: str | None = None
