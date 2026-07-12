from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}


def media_root() -> Path:
    root = Path(settings.media_root)
    if not root.is_absolute():
        root = Path(__file__).resolve().parent.parent / root
    root.mkdir(parents=True, exist_ok=True)
    return root


async def save_upload(file: UploadFile, subdir: str) -> tuple[str, str]:
    content_type = file.content_type or "application/octet-stream"
    if content_type in ALLOWED_IMAGE:
        max_bytes = settings.max_image_mb * 1024 * 1024
        media_type = "image"
    elif content_type in ALLOWED_VIDEO:
        max_bytes = settings.max_video_mb * 1024 * 1024
        media_type = "video"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type: {content_type}")

    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large")

    ext = Path(file.filename or "file").suffix or (".jpg" if media_type == "image" else ".mp4")
    rel = f"{subdir}/{uuid.uuid4()}{ext}"
    path = media_root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel, media_type


def resolve_media_path(rel_path: str) -> Path | None:
    path = media_root() / rel_path
    return path if path.exists() else None
