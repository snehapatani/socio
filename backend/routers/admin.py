"""Admin routes — protected by profiles.role = 'admin'."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from db.client import supabase
from routers.auth import require_admin
from config import settings

router = APIRouter()


# ── List all businesses ──────────────────────────────────────────────
@router.get("/businesses", dependencies=[Depends(require_admin)])
def list_all_businesses():
    biz = (
        supabase.table("businesses")
        .select(
            "id, name, slug, owner_email, owner_id, business_type, brand_tone, "
            "sub_status, plan_id, posts_used_this_week, onboarding_done, "
            "sub_start_date, sub_end_date, stripe_customer_id, "
            "created_at, updated_at"
        )
        .order("created_at", desc=True)
        .execute()
    )
    rows = biz.data or []
    if not rows:
        return {"businesses": [], "total": 0}

    ids = [b["id"] for b in rows]
    igs = (
        supabase.table("instagram_pages")
        .select("business_id, ig_username, followers_count, is_active, token_expires_at, connected_at")
        .in_("business_id", ids)
        .execute()
    )
    ig_by_biz = {ig["business_id"]: ig for ig in (igs.data or [])}
    for b in rows:
        b["instagram_page"] = ig_by_biz.get(b["id"])

    return {"businesses": rows, "total": len(rows)}


# ── Aggregate stats ──────────────────────────────────────────────────
@router.get("/stats", dependencies=[Depends(require_admin)])
def admin_stats():
    biz = supabase.table("businesses").select("id, sub_status, onboarding_done").execute()
    rows = biz.data or []

    by_status: dict[str, int] = {}
    onboarded = 0
    for b in rows:
        s = b.get("sub_status") or "unknown"
        by_status[s] = by_status.get(s, 0) + 1
        if b.get("onboarding_done"):
            onboarded += 1

    igs = supabase.table("instagram_pages").select("id, is_active").execute()
    ig_total  = len(igs.data or [])
    ig_active = sum(1 for ig in (igs.data or []) if ig.get("is_active"))

    posts = supabase.table("posts").select("id, status").execute()
    posts_data = posts.data or []
    by_post_status: dict[str, int] = {}
    for p in posts_data:
        s = p.get("status") or "unknown"
        by_post_status[s] = by_post_status.get(s, 0) + 1

    return {
        "businesses": {
            "total":         len(rows),
            "onboarded":     onboarded,
            "by_sub_status": by_status,
        },
        "instagram": {"total": ig_total, "active": ig_active},
        "posts":     {"total": len(posts_data), "by_status": by_post_status},
    }


# ── Single business detail ──────────────────────────────────────────
@router.get("/businesses/{business_id}", dependencies=[Depends(require_admin)])
def get_business_admin(business_id: str):
    biz = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found.")

    ig = (
        supabase.table("instagram_pages")
        .select("*")
        .eq("business_id", business_id)
        .maybe_single()
        .execute()
    )
    posts = (
        supabase.table("posts")
        .select("id, status, scheduled_at, published_at, caption")
        .eq("business_id", business_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        **biz.data,
        "instagram_page": ig.data if ig else None,
        "recent_posts":   posts.data or [],
    }


# ── Update business (admin can change plan, status, etc.) ───────────
class AdminBusinessUpdate(BaseModel):
    sub_status:    Optional[str] = None
    plan_id:       Optional[str] = None
    sub_end_date:  Optional[str] = None
    onboarding_done: Optional[bool] = None


@router.patch("/businesses/{business_id}", dependencies=[Depends(require_admin)])
def update_business_admin(business_id: str, body: AdminBusinessUpdate):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided.")

    result = (
        supabase.table("businesses")
        .update(updates)
        .eq("id", business_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Business not found.")
    return result.data[0]


# ── Soft-suspend a business ─────────────────────────────────────────
@router.post("/businesses/{business_id}/suspend", dependencies=[Depends(require_admin)])
def suspend_business(business_id: str):
    result = (
        supabase.table("businesses")
        .update({"sub_status": "cancelled"})
        .eq("id", business_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Business not found.")
    return {"ok": True, "business": result.data[0]}

# ── Soft delete (always available) ──────────────────────────────────
@router.delete("/businesses/{business_id}", dependencies=[Depends(require_admin)])
def soft_delete_business(business_id: str):
    """Mark business as deleted. Reversible.

    Side effects beyond setting deleted_at:
      - sub_status → cancelled (stops billing-related logic)
      - instagram_pages.is_active → false (revokes posting)
    """
    biz = (
        supabase.table("businesses")
        .update({"deleted_at": "now()", "sub_status": "cancelled"})
        .eq("id", business_id)
        .is_("deleted_at", "null")     # don't re-delete
        .execute()
    )
    if not biz.data:
        raise HTTPException(404, "Business not found or already deleted.")

    # Deactivate any linked IG pages so the scheduler stops trying to publish
    supabase.table("instagram_pages") \
        .update({"is_active": False}) \
        .eq("business_id", business_id) \
        .execute()

    return {"ok": True, "business": biz.data[0]}


# ── Restore a soft-deleted business ─────────────────────────────────
@router.post("/businesses/{business_id}/restore", dependencies=[Depends(require_admin)])
def restore_business(business_id: str):
    biz = (
        supabase.table("businesses")
        .update({"deleted_at": None})
        .eq("id", business_id)
        .execute()
    )
    if not biz.data:
        raise HTTPException(404, "Business not found.")
    return {"ok": True, "business": biz.data[0]}


# ── Hard delete (development/staging only) ──────────────────────────
@router.delete("/businesses/{business_id}/purge", dependencies=[Depends(require_admin)])
def hard_delete_business(business_id: str):
    """Permanently delete business and all related rows.
    BLOCKED in production. Use soft delete instead.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            403,
            "Hard delete is disabled in production. Use soft delete, "
            "or run a manual SQL script with documented justification.",
        )

    # Order matters — children first (no CASCADE on these FKs)
    # 1. post_insights (FK → posts)
    post_ids = supabase.table("posts").select("id").eq("business_id", business_id).execute()
    if post_ids.data:
        ids = [p["id"] for p in post_ids.data]
        supabase.table("post_insights").delete().in_("post_id", ids).execute()

    # 2. The rest can go in any order (all FK directly to businesses)
    for table in ["posts", "media_library", "instagram_pages", "approval_tokens"]:
        supabase.table(table).delete().eq("business_id", business_id).execute()

    # 3. Storage cleanup — list and remove the businesses/{id}/ folder
    try:
        # List all objects under the business's storage prefix
        files = supabase.storage.from_("media").list(f"businesses/{business_id}")
        if files:
            paths = [f"businesses/{business_id}/{f['name']}" for f in files]
            supabase.storage.from_("media").remove(paths)
    except Exception as e:
        # Don't block delete on storage cleanup failure — just log
        import logging
        logging.warning("Storage cleanup failed for %s: %s", business_id, e)

    # 4. Finally, the business itself
    result = supabase.table("businesses").delete().eq("id", business_id).execute()
    if not result.data:
        raise HTTPException(404, "Business not found.")

    return {"ok": True, "purged": True}
