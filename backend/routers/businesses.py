from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, EmailStr
from database import supabase
from config import settings
from typing import Optional, Annotated, Dict, Any
import uuid

router = APIRouter()


class BusinessCreate(BaseModel):
    name: str
    business_type: str          # restaurant, salon, gym, etc.
    owner_email: str
    brand_tone: Optional[str] = "warm_friendly"   # renamed from tone
    business_context: Optional[dict] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    brand_tone: Optional[str] = None
    business_context: Optional[dict] = None

# ── Create business (onboarding step 1) ──────────────────────────────
@router.post("/")
def create_business(body: BusinessCreate):
    result = supabase.table("businesses").insert({
        "name":             body.name,
        "owner_email":      body.owner_email,
        "business_type":    body.business_type,
        "brand_tone":       body.brand_tone,
        "business_context": body.business_context or {},
    }).execute()

    if not result.data:
        raise HTTPException(500, "Failed to create business")
    return result.data[0]


# ── Upload brand photo → Supabase Storage ────────────────────────────
@router.post("/{business_id}/upload")
async def upload_media(business_id: str, file: UploadFile = File(...)):
    contents = await file.read()
    ext       = file.filename.split(".")[-1].lower()
    post_id   = str(uuid.uuid4())
    path      = f"businesses/{business_id}/posts/{post_id}.{ext}"

    supabase.storage.from_("media").upload(
        path=path,
        file=contents,
        file_options={"content-type": file.content_type},
    )

    # Build the permanent public URL
    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"
    return {"media_url": public_url, "media_storage_path": path, "post_id": post_id}


# ── Get business + linked IG page ────────────────────────────────────
@router.get("/{business_id}")
def get_business(business_id: str):
    biz = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found")

    ig = supabase.table("instagram_pages").select(
        "id, ig_username, ig_user_id, followers_count, profile_picture_url, is_active, token_expires_at"
    ).eq("business_id", business_id).maybe_single().execute()

    return {**biz.data, "instagram_page": ig.data if ig else None}


# ── Update brand context ──────────────────────────────────────────────
@router.patch("/{business_id}")
def update_business(business_id: str, body: BusinessUpdate):
    # Fetch existing JSONB first so we can merge, not overwrite
    existing = (
        supabase.table("businesses")
        .select("business_context")
        .eq("id", business_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Business not found")

    updates = {}
    if body.name          is not None: updates["name"]          = body.name
    if body.business_type is not None: updates["business_type"] = body.business_type
    if body.brand_tone    is not None: updates["brand_tone"]    = body.brand_tone
    if body.business_context is not None:
        merged = {**(existing.data.get("business_context") or {}), **body.business_context}
        updates["business_context"] = merged

    if not updates:
        return existing.data

    result = supabase.table("businesses").update(updates).eq("id", business_id).execute()


@router.post("/{business_id}/upload-media")
async def upload_to_library(business_id: str, file: Annotated[UploadFile, File()]):
    contents = await file.read()
    ext      = (file.filename or "file").split(".")[-1].lower()
    media_id = str(uuid.uuid4())
    path     = f"businesses/{business_id}/library/{media_id}.{ext}"

    supabase.storage.from_("media").upload(
        path=path,
        file=contents,
        file_options={"content-type": file.content_type or "image/jpeg"},
    )

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"

    row = supabase.table("media_library").insert({
        "business_id":  business_id,
        "media_url":    public_url,
        "storage_path": path,
        "times_used":   0,
        "is_active":    True,
        "content_type": file.content_type
    }).execute()

    # Count total unused photos available for next generation
    unused = supabase.table("media_library").select("id").eq(
        "business_id", business_id
    ).eq("is_active", True).eq("times_used", 0).execute()

    return {
        "media_url":     public_url,
        "storage_path":  path,
        "id":            row.data[0]["id"],
        "unused_count":  len(unused.data or []),
        "ready":         len(unused.data or []) >= 3,
    }


# GET media library — shows owner their photo bank
@router.get("/{business_id}/media-library")
def get_media_library(business_id: str):
    result = supabase.table("media_library").select(
        "id, media_url, times_used, last_used_at, created_at", "content_type"
    ).eq("business_id", business_id).eq(
        "is_active", True
    ).order("created_at", desc=True).execute()

    photos = result.data or []
    unused = [p for p in photos if p["times_used"] == 0]

    return {
        "photos":       photos,
        "total":        len(photos),
        "unused_count": len(unused),
        "ready":        len(unused) >= 3,
    }
