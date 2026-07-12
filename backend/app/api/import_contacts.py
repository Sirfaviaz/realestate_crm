from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.services.import_contacts import (
    TEMPLATES,
    confirm_import,
    generate_template_workbook,
    preview_import,
)

router = APIRouter(prefix="/import", tags=["import"])


class ConfirmRequest(BaseModel):
    preview_id: str
    update_duplicates: bool = False


@router.get("/contacts/{role}/template")
async def download_template(
    role: str,
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    if role not in TEMPLATES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown contact type")
    wb = generate_template_workbook(role)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{role}_template.xlsx"'},
    )


@router.post("/contacts/{role}")
async def upload_preview(
    role: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    if role not in TEMPLATES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown contact type")
    data = await file.read()
    try:
        return await preview_import(db, role, data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post("/contacts/confirm")
async def confirm(
    body: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.USER)),
):
    try:
        return await confirm_import(db, body.preview_id, body.update_duplicates, user.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
