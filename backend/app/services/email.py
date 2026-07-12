import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> bool:
    if not settings.smtp_host:
        logger.info("SMTP not configured — email logged instead:\nTo: %s\nSubject: %s\n%s", to, subject, body)
        return True

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=True,
    )
    return True


def format_builder_lead_email(snapshot: dict, agent_name: str, agent_phone: str | None) -> tuple[str, str]:
    subject = f"New Lead: {snapshot.get('contact_name', 'Unknown')} — {snapshot.get('project_name', 'Property')}"
    lines = [
        "New lead from Real Estate CRM",
        "",
        f"Contact: {snapshot.get('contact_name')}",
        f"Phone: {snapshot.get('contact_phone')}",
        f"Email: {snapshot.get('contact_email', 'N/A')}",
        "",
        "Requirement:",
        snapshot.get("requirement_summary") or snapshot.get("notes") or "N/A",
        "",
        "Matched Property:",
        f"  Location: {snapshot.get('location_name', 'N/A')}",
        f"  Project: {snapshot.get('project_name', 'N/A')}",
        f"  Configuration: {snapshot.get('configuration', 'N/A')}",
        f"  Sq Ft: {snapshot.get('sqft', 'N/A')}",
        f"  Price/Rent: {snapshot.get('price', 'N/A')}",
        "",
        f"Agent: {agent_name}",
        f"Agent Phone: {agent_phone or 'N/A'}",
    ]
    return subject, "\n".join(lines)
