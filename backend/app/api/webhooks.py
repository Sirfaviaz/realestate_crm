import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.whatsapp import WhatsAppMessage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp")
async def whatsapp_verify(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return int(hub_challenge)
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Verification failed")


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Phase 2 stub — logs inbound messages when Meta webhook is configured."""
    payload = await request.json()
    logger.info("WhatsApp webhook received: %s", payload)
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    phone = msg.get("from", "")
                    text = msg.get("text", {}).get("body", "")
                    contact_id = None
                    db.add(
                        WhatsAppMessage(
                            contact_id=UUID(contact_id) if contact_id else None,
                            direction="inbound",
                            phone=phone,
                            content=text,
                            external_id=msg.get("id"),
                        )
                    )
        await db.commit()
    except Exception as exc:
        logger.warning("WhatsApp webhook parse error: %s", exc)
    return {"status": "ok"}
