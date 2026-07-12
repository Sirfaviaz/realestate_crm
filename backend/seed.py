"""Seed database accounts (and optional demo inventory).

Admin-only (default for production / VM):

    python seed.py --admin-only
    # or
    SEED_MODE=admin python seed.py

Configure the admin via env (recommended on VM):

    SEED_ADMIN_EMAIL=you@company.com
    SEED_ADMIN_PASSWORD=strong-password
    SEED_ADMIN_NAME=Your Name
    SEED_ADMIN_PHONE=+919999000001

Full demo inventory (local dev only):

    python seed.py --demo
"""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.database import AsyncSessionLocal, Base, engine
import app.models  # noqa: F401 — register all mappers (incl. BuilderSubmission)
from app.models.contact import Contact
from app.models.inventory import Location, Project, UnitOption, UnitSpec
from app.models.listing import Listing
from app.models.user import User
from app.services.password import hash_password

LEGACY_EMAIL_MAP = {
    "admin@crm.local": "admin@example.com",
    "agent@crm.local": "user@example.com",
    "data@crm.local": "user@example.com",
    "data@example.com": "user@example.com",
    "builder@crm.local": "user@example.com",
    "agent@example.com": "user@example.com",
    "builder@example.com": "user@example.com",
}

ROLE_MIGRATIONS = {
    "lessee": "renter",
    "lessor": "landlord",
}


def _admin_from_env() -> tuple[str, str, str, str | None]:
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@example.com").strip()
    password = os.getenv("SEED_ADMIN_PASSWORD", "admin123").strip()
    name = os.getenv("SEED_ADMIN_NAME", "Admin User").strip()
    phone = os.getenv("SEED_ADMIN_PHONE", "").strip() or None
    if not email or not password:
        raise SystemExit("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required")
    return email, password, name, phone


async def migrate_legacy_data(db) -> None:
    for old_email, new_email in LEGACY_EMAIL_MAP.items():
        result = await db.execute(select(User).where(User.email == old_email))
        user = result.scalar_one_or_none()
        if not user:
            continue
        if user.role in ("agent", "data_entry", "builder"):
            user.role = "user"
        if user.email != new_email:
            existing = await db.execute(select(User).where(User.email == new_email))
            if existing.scalar_one_or_none() and user.email != new_email:
                await db.delete(user)
            else:
                user.email = new_email

    for user in (await db.execute(select(User).where(User.role.in_(["agent", "data_entry", "builder"])))).scalars().all():
        user.role = "user"

    contacts = (await db.execute(select(Contact))).scalars().all()
    for contact in contacts:
        contact.roles = [ROLE_MIGRATIONS.get(r, r) for r in contact.roles]


async def ensure_admin(db, *, email: str, password: str, name: str, phone: str | None) -> User | None:
    """Create admin if missing. Returns the new user, or None if already present."""
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        return None
    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        phone=phone,
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


async def seed_demo_inventory(db, crm_user: User) -> None:
    loc1 = Location(
        area="Whitefield",
        city="Bangalore",
        state="Karnataka",
        pin_code="560066",
        latitude=12.9698,
        longitude=77.7499,
    )
    loc2 = Location(
        area="Powai",
        city="Mumbai",
        state="Maharashtra",
        pin_code="400076",
        latitude=19.1176,
        longitude=72.9060,
    )
    db.add_all([loc1, loc2])
    await db.flush()

    proj1 = Project(
        location_id=loc1.id,
        name="Green Valley Residency",
        builder_name="Prestige Group",
        rera_id="PRM/KA/RERA/1250/308/PR/171018/000123",
        possession_status="Ready to Move",
        amenities=["Pool", "Gym", "Clubhouse", "Parking"],
        extra_fields={"towers": ["Tower A", "Tower B"], "total_units": 240},
    )
    proj2 = Project(
        location_id=loc2.id,
        name="Lakeview Heights",
        builder_name="Lodha Group",
        possession_status="Under Construction",
        possession_date=date(2027, 6, 1),
        amenities=["Garden", "Security", "Power Backup"],
    )
    db.add_all([proj1, proj2])
    await db.flush()

    opt1 = UnitOption(project_id=proj1.id, configuration="2 BHK", tower="Tower A", availability_count=12, stream_type="sales")
    opt2 = UnitOption(project_id=proj1.id, configuration="3 BHK", tower="Tower B", availability_count=8, stream_type="sales")
    opt3 = UnitOption(project_id=proj2.id, configuration="2 BHK", availability_count=5, stream_type="rental")
    db.add_all([opt1, opt2, opt3])
    await db.flush()

    specs = [
        UnitSpec(option_id=opt1.id, carpet_sqft=980, built_up_sqft=1150, sale_price=8500000, floor="5", facing="East", status="available", stream_type="sales"),
        UnitSpec(option_id=opt1.id, carpet_sqft=1020, built_up_sqft=1200, sale_price=9200000, floor="12", facing="North", status="available", stream_type="sales"),
        UnitSpec(option_id=opt2.id, carpet_sqft=1350, built_up_sqft=1580, sale_price=12500000, floor="8", facing="West", status="available", stream_type="sales"),
        UnitSpec(option_id=opt3.id, carpet_sqft=900, rent_price=45000, floor="3", furnishing="Semi-furnished", status="available", stream_type="rental"),
    ]
    db.add_all(specs)

    now = datetime.now(UTC)
    contacts = [
        Contact(
            name="Rahul Sharma", phone="+919876543210", roles=["buyer"], stream_type="sales",
            budget_min=7000000, budget_max=10000000, preferred_bhk="2 BHK",
            urgency="urgent", lead_score="hot", follow_up_at=now + timedelta(hours=2),
            assigned_user_id=crm_user.id,
        ),
        Contact(
            name="Priya Patel", phone="+919876543211", roles=["renter"], stream_type="rental",
            rent_budget=50000, preferred_locations=["Powai"], urgency="soon", lead_score="warm",
            site_visit_at=now.replace(hour=15, minute=0), site_visit_location="Lakeview Heights, Powai",
            assigned_user_id=crm_user.id,
        ),
        Contact(
            name="Amit Kumar", phone="+919876543212", roles=["seller"], stream_type="sales",
            property_location="Whitefield, Bangalore", preferred_bhk="3 BHK", asking_price=11000000,
            urgency="flexible", lead_score="warm", notes="Wants to sell 3BHK in Whitefield",
            assigned_user_id=crm_user.id,
        ),
    ]
    db.add_all(contacts)
    await db.flush()

    seller = contacts[2]
    db.add(
        Listing(
            contact_id=seller.id,
            stream_type="sales",
            title="3 BHK in Whitefield",
            location_text="Whitefield, Bangalore",
            bhk="3 BHK",
            sqft=1350,
            price=11000000,
            status="available",
            created_by_id=crm_user.id,
        )
    )


async def seed(*, mode: str) -> None:
    email, password, name, phone = _admin_from_env()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await migrate_legacy_data(db)
        await db.commit()

        admin = await ensure_admin(db, email=email, password=password, name=name, phone=phone)
        if admin is None:
            print(f"Admin already exists: {email}")
            print("No changes made (use wipe + re-seed for a clean DB).")
            return

        if mode == "demo":
            demo_user = User(
                email=os.getenv("SEED_DEMO_USER_EMAIL", "user@example.com").strip(),
                password_hash=hash_password(os.getenv("SEED_DEMO_USER_PASSWORD", "user123").strip()),
                name=os.getenv("SEED_DEMO_USER_NAME", "CRM User").strip(),
                phone=os.getenv("SEED_DEMO_USER_PHONE", "+919999000002").strip() or None,
                role="user",
            )
            db.add(demo_user)
            await db.flush()
            await seed_demo_inventory(db, demo_user)
            await db.commit()
            print("Demo seed complete!")
            print(f"  admin: {email} / {password}")
            print(f"  user:  {demo_user.email} / {os.getenv('SEED_DEMO_USER_PASSWORD', 'user123')}")
            return

        await db.commit()
        print("Admin-only seed complete!")
        print(f"  {email} / {password}")
        print("Create team users from Admin → Users after login.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Real Estate CRM database")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--admin-only",
        action="store_true",
        help="Create only the admin account (no demo inventory)",
    )
    group.add_argument(
        "--demo",
        action="store_true",
        help="Create admin + demo user + sample inventory",
    )
    args = parser.parse_args()

    env_mode = os.getenv("SEED_MODE", "").strip().lower()
    if args.demo or env_mode == "demo":
        mode = "demo"
    else:
        # Default: admin-only (safe for VM / real data)
        mode = "admin"

    asyncio.run(seed(mode=mode))


if __name__ == "__main__":
    main()
