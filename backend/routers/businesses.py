from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from postgrest.exceptions import APIError
from typing import Optional

from db.client import supabase
from db.errors import handle_pg_error
from routers.auth import get_current_user, require_owner_or_admin

router = APIRouter()


class BusinessCreate(BaseModel):
    name: str
    business_type: str
    brand_tone: Optional[str] = "warm_friendly"
    business_context: Optional[dict] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    brand_tone: Optional[str] = None
    business_context: Optional[dict] = None


# ── Current user's business ──────────────────────────────────────────
@router.get("/me")
def get_my_business(user: dict = Depends(get_current_user)):
    biz = (
        supabase.table("businesses")
        .select("*")
        .eq("owner_id", user["id"])
        .is_("deleted_at", "null")
        .maybe_single()
        .execute()
    )
    if not biz or not biz.data:
        return None  # frontend treats this as "no business yet → onboarding"

    ig = (
        supabase.table("instagram_pages")
        .select("*")
        .eq("business_id", biz.data["id"])
        .maybe_single()
        .execute()
    )
    return {**biz.data, "instagram_page": ig.data if ig else None}


# ── Create business (onboarding) ─────────────────────────────────────
@router.post("/")
def create_business(body: BusinessCreate, user: dict = Depends(get_current_user)):
    try:
        result = supabase.table("businesses").insert({
            "name":             body.name,
            "owner_email":      user["email"],
            "owner_id":         user["id"],
            "business_type":    body.business_type,
            "brand_tone":       body.brand_tone,
            "business_context": body.business_context or {},
        }).execute()
    except APIError as e:
        handle_pg_error(
            e,
            on_conflict="You already have a business — sign in instead.",
            on_conflict_fields={
                "owner_email": "An account with this email already exists. Try signing in.",
                "owner_id":    "You already have a business — sign in instead.",
            },
        )

    if not result.data:
        raise HTTPException(500, "Failed to create business")
    return result.data[0]


# ── Get business + IG page (owner or admin) ─────────────────────────
@router.get("/{business_id}")
def get_business(business_id: str, _: dict = Depends(require_owner_or_admin)):
    biz = (
        supabase.table("businesses")
        .select("*")
        .eq("id", business_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(404, "Business not found")

    ig = (
        supabase.table("instagram_pages")
        .select("id, ig_username, ig_user_id, followers_count, profile_picture_url, is_active, token_expires_at")
        .eq("business_id", business_id)
        .maybe_single()
        .execute()
    )
    return {**biz.data, "instagram_page": ig.data if ig else None}


# ── Update business (owner or admin) ────────────────────────────────
@router.patch("/{business_id}")
def update_business(business_id: str, body: BusinessUpdate, _: dict = Depends(require_owner_or_admin)):
    existing = (
        supabase.table("businesses")
        .select("business_context")
        .eq("id", business_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Business not found")

    updates = {}
    if body.name             is not None: updates["name"]          = body.name
    if body.business_type    is not None: updates["business_type"] = body.business_type
    if body.brand_tone       is not None: updates["brand_tone"]    = body.brand_tone
    if body.business_context is not None:
        merged = {**(existing.data.get("business_context") or {}), **body.business_context}
        updates["business_context"] = merged

    if not updates:
        return existing.data

    try:
        result = (
            supabase.table("businesses")
            .update(updates)
            .eq("id", business_id)
            .execute()
        )
    except APIError as e:
        handle_pg_error(e, on_conflict="That update conflicts with existing data.")

    if not result.data:
        raise HTTPException(500, "Failed to update business")
    return result.data[0]
