"""Apply lightweight schema migrations for dev (no Alembic)."""

import logging

from sqlalchemy import select, text

from app.database import AsyncSessionLocal, engine

logger = logging.getLogger(__name__)

MIGRATIONS = [
    "ALTER TABLE contacts RENAME COLUMN assigned_agent_id TO assigned_user_id",
    "ALTER TABLE deals RENAME COLUMN assigned_agent_id TO assigned_user_id",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS property_location VARCHAR(512)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS asking_price DOUBLE PRECISION",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sqft DOUBLE PRECISION",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS timeline_date DATE",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS urgency VARCHAR(32)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score VARCHAR(32)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS site_visit_at TIMESTAMPTZ",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS site_visit_location VARCHAR(512)",
    "UPDATE users SET role = 'user' WHERE role IN ('agent', 'data_entry', 'builder')",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_type VARCHAR(32)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(32)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS occupant_count INTEGER",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profession VARCHAR(128)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workplace_text VARCHAR(512)",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workplace_lat DOUBLE PRECISION",
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workplace_lng DOUBLE PRECISION",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS location_anchors JSONB",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS city VARCHAR(128)",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS search_radius_km DOUBLE PRECISION DEFAULT 5",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS preferred_tenant_types VARCHAR[]",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS security_deposit DOUBLE PRECISION",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS maintenance DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS maintenance DOUBLE PRECISION",
    "ALTER TABLE requirement_matches ADD COLUMN IF NOT EXISTS matched_requirement_id UUID REFERENCES lead_requirements(id)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS builder_name VARCHAR(255)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS project_name VARCHAR(255)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS land_area_cent DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS launching_time VARCHAR(128)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS completion_time VARCHAR(128)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_floors INTEGER",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS parking_details TEXT",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS available_floors VARCHAR(255)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS amenities VARCHAR[]",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS base_price DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS car_parking_price DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS gst_percent DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS down_payment_percent DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS utility_charge DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_instalment DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS total_amount DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_as_of_date DATE",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS monthly_rent DOUBLE PRECISION",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS security_deposit DOUBLE PRECISION",
    "ALTER TABLE lead_requirements ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id)",
]


async def migrate_contact_requirements() -> None:
    """One-time: create LeadRequirement rows from contacts with search prefs."""
    from app.models.contact import Contact
    from app.models.requirement import LeadRequirement

    async with AsyncSessionLocal() as db:
        contacts = (await db.execute(select(Contact))).scalars().all()
        created = 0
        for c in contacts:
            has_prefs = (
                c.preferred_locations
                or c.preferred_bhk
                or c.budget_min
                or c.budget_max
                or c.rent_budget
            )
            if not has_prefs:
                continue
            role = c.roles[0] if c.roles else "buyer"
            existing = (
                await db.execute(
                    select(LeadRequirement).where(LeadRequirement.contact_id == c.id).limit(1)
                )
            ).scalar_one_or_none()
            if existing:
                continue
            db.add(
                LeadRequirement(
                    contact_id=c.id,
                    role=role,
                    stream_type=c.stream_type,
                    preferred_locations=c.preferred_locations,
                    bhk=c.preferred_bhk,
                    budget_min=c.budget_min,
                    budget_max=c.budget_max,
                    rent_budget=c.rent_budget,
                    move_in_date=c.move_in_date,
                    urgency=c.urgency,
                    lead_score=c.lead_score,
                    status="active",
                    notes=c.notes,
                    assigned_user_id=c.assigned_user_id,
                )
            )
            created += 1
        if created:
            await db.commit()
            logger.info("Migrated %s contact prefs to lead requirements", created)


async def run_migrations() -> None:
    for sql in MIGRATIONS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as exc:
            logger.debug("Migration skipped: %s — %s", sql[:60], exc)
    try:
        await migrate_contact_requirements()
    except Exception as exc:
        logger.debug("Contact requirement migration skipped: %s", exc)
    try:
        from app.services.listing_sync import sync_listings_from_supply_leads

        async with AsyncSessionLocal() as db:
            await sync_listings_from_supply_leads(db)
    except Exception as exc:
        logger.debug("Supply listing sync skipped: %s", exc)
