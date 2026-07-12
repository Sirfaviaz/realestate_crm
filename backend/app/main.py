import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import auth, builders, contacts, dashboard, import_contacts, inventory, listings, requirements, search, webhooks
from app.config import settings
from app.database import Base, engine
from app.migrate import run_migrations

logger = logging.getLogger(__name__)


async def init_db() -> None:
    for ext, label in [("postgis", "PostGIS"), ("pg_trgm", "pg_trgm")]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"CREATE EXTENSION IF NOT EXISTS {ext}"))
        except Exception:
            logger.info("%s not available — continuing without it", label)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_db()
        await run_migrations()
    except Exception as exc:
        logger.warning("Database init deferred: %s", exc)
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(import_contacts.router)
app.include_router(listings.router)
app.include_router(requirements.router)
app.include_router(requirements.matches_router)
app.include_router(inventory.router)
app.include_router(contacts.router)
app.include_router(contacts.deals_router)
app.include_router(builders.router)
app.include_router(search.router)
app.include_router(webhooks.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
