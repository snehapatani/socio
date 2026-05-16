from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from postgrest.exceptions import APIError
from typing import Annotated
import io
import uuid
from PIL import Image

from db.client import supabase
from db.errors import handle_pg_error
from config import settings
from core.auth import require_owner_or_admin

router = APIRouter()

# ── Image processing ──────────────────────────────────────────────────
def process_image(contents: bytes) -> tuple[bytes, str]:
    """Flatten, resize, and convert image to JPEG for Meta compliance."""
    img = Image.open(io.BytesIO(contents))

    # Handle transparency (Meta won't accept RGBA)
    if img.mode in ("RGBA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
        img = background
    else:
        img = img.convert("RGB")

    # Standardize width to 1080px (Meta's preferred width)
    if img.width > 1080:
        w_percent = 1080 / float(img.width)
        h_size = int(float(img.height) * w_percent)
        img = img.resize((1080, h_size), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90, optimize=True)
    return buffer.getvalue(), "image/jpeg"

# ── Upload brand photo → Supabase Storage ────────────────────────────
@router.post("/{business_id}/upload")
async def upload_media(business_id: str, file: UploadFile = File(...)):
    contents = await file.read()
    ext      = file.filename.split(".")[-1].lower()
    post_id  = str(uuid.uuid4())
    path     = f"businesses/{business_id}/posts/{post_id}.{ext}"

    supabase.storage.from_("media").upload(
        path=path,
        file=contents,
        file_options={"content-type": file.content_type},
    )

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"
    return {"media_url": public_url, "media_storage_path": path, "post_id": post_id}

# ── Upload media to library ───────────────────────────────────────────
@router.post("/{business_id}/upload-media")
async def upload_to_library(business_id: str, file: Annotated[UploadFile, File()]):
    raw_contents = await file.read()
    content_type = file.content_type or ""

    is_image = content_type.startswith("image/")
    is_video = content_type.startswith("video/")

    if is_image:
        try:
            processed_contents, final_mime = process_image(raw_contents)
            ext = "jpg"
        except Exception as e:
            raise HTTPException(400, f"Image processing failed: {str(e)}")
    elif is_video:
        # Pillow can't open videos — pass through unchanged
        processed_contents = raw_contents
        final_mime = content_type
        ext = (file.filename or "video.mp4").split(".")[-1].lower()
    else:
        raise HTTPException(400, "Unsupported file type. Please upload an image or video.")

    media_id = str(uuid.uuid4())
    path = f"businesses/{business_id}/library/{media_id}.{ext}"

    supabase.storage.from_("media").upload(
        path=path,
        file=processed_contents,
        file_options={"content-type": final_mime},
    )

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"

    try:
        row = supabase.table("media_library").insert({
            "business_id":  business_id,
            "media_url":    public_url,
            "storage_path": path,
            "times_used":   0,
            "is_active":    True,
            "content_type": final_mime,
        }).execute()
    except APIError as e:
        handle_pg_error(e, on_conflict="That media item is already in your library.")

    unused = (
        supabase.table("media_library")
        .select("id")
        .eq("business_id", business_id)
        .eq("is_active", True)
        .eq("times_used", 0)
        .execute()
    )

    return {
        "media_url":    public_url,
        "storage_path": path,
        "id":           row.data[0]["id"],
        "unused_count": len(unused.data or []),
        "ready":        len(unused.data or []) >= 3,
    }


# ── Get media library ─────────────────────────────────────────────────
@router.get("/{business_id}/media-library")
def get_media_library(business_id: str):
    result = (
        supabase.table("media_library")
        .select("id, media_url, times_used, last_used_at, created_at, content_type")
        .eq("business_id", business_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )

    photos = result.data or []
    unused = [p for p in photos if p["times_used"] == 0]

    return {
        "photos":       photos,
        "total":        len(photos),
        "unused_count": len(unused),
        "ready":        len(unused) >= 3,
    }

@router.delete("/{business_id}/media-library/{media_id}")
def delete_media(
    business_id: str,
    media_id: str,
    _: dict = Depends(require_owner_or_admin),
):
    """Soft delete: mark inactive but keep storage + row.
    Posts that already reference this media stay intact.
    """
    result = (
        supabase.table("media_library")
        .update({"is_active": False})
        .eq("id", media_id)
        .eq("business_id", business_id)
        .eq("is_active", True)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Media not found or already removed.")
    return {"ok": True}
