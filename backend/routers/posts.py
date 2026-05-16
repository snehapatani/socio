"""HTTP routes for posts — thin layer over services/."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db.client import supabase
from core.auth import require_owner_or_admin, get_current_user
from core.quota import consume_post_quota

from services.captions          import generate_post_captions, generate_carousel_caption
from services.image_generator   import generate_and_store_image
from services.media_selector    import pick_media_for_generation
from services.post_scheduler    import get_best_schedule
from services.ig_publisher      import publish_post as ig_publish_post
from services.post_insights     import fetch_and_store_insights

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────
class CarouselRequest(BaseModel):
    media_library_ids: list[str]  # 2-10 items, in display order


class PostUpdate(BaseModel):
    caption:            Optional[str] = None
    media_url:          Optional[str] = None
    media_storage_path: Optional[str] = None
    scheduled_at:       Optional[str] = None


# ── Generate weekly posts (3 singles) ────────────────────────────────
@router.post("/generate/{business_id}")
def generate_posts(business_id: str, _: dict = Depends(require_owner_or_admin)):
    business = _get_business(business_id)
    ig_page  = _get_active_ig_page(business_id)

    consume_post_quota(business_id, "single")
    media     = pick_media_for_generation(business_id, count=3)
    schedule  = get_best_schedule(business_id)
    captions  = generate_post_captions(business, media)
    try:
        inserted = []
        for i, photo in enumerate(media[:3]):
            post = captions[i]
            media_type = "VIDEO" if (photo.get("content_type") or "").startswith("video") else "IMAGE"

            row = supabase.table("posts").insert({
                "business_id":         business_id,
                "ig_page_id":          ig_page["id"],
                "caption":             post["caption"],
                "hashtags":            post.get("hashtags", []),
                "media_type":          media_type,
                "media_urls":          [photo["media_url"]],
                "media_storage_paths": [photo["storage_path"]],
                "media_library_ids":   [photo["id"]],
                "status":              "pending_approval",
                "scheduled_at":        schedule[i].isoformat(),
            }).execute()
            inserted.append(row.data[0])

            # Bump usage counter on the source media
            supabase.table("media_library").update({
                "times_used":   (photo.get("times_used") or 0) + 1,
                "last_used_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", photo["id"]).execute()

            return {"generated": len(inserted), "posts": inserted}

    except Exception:
        supabase.rpc("refund_post_quota", {"biz_id": business_id, "post_type": "single"}).execute()
        raise




# ── Generate carousel (paid-plan feature, separate quota) ───────────
@router.post("/generate-carousel/{business_id}")
def generate_carousel(
    business_id: str,
    body: CarouselRequest,
    _: dict = Depends(require_owner_or_admin),
):
    if not 2 <= len(body.media_library_ids) <= 10:
        raise HTTPException(400, "Carousel needs 2-10 items.")

    business = _get_business(business_id)
    ig_page  = _get_active_ig_page(business_id)

    consume_post_quota(business_id, "carousel")
    try:
        media = (
            supabase.table("media_library")
            .select("id, media_url, storage_path, content_type, times_used")
            .in_("id", body.media_library_ids)
            .execute().data
        )
        # Preserve the user's chosen order
        order = {mid: i for i, mid in enumerate(body.media_library_ids)}
        media.sort(key=lambda m: order[m["id"]])

        caption_obj = generate_carousel_caption(business, media)
        schedule = get_best_schedule(business_id)
        scheduled_at = schedule[0].isoformat()

        post = supabase.table("posts").insert({
            "business_id":         business_id,
            "ig_page_id":          ig_page["id"],
            "media_type":          "CAROUSEL",
            "media_urls":          [m["media_url"]    for m in media],
            "media_storage_paths": [m["storage_path"] for m in media],
            "media_library_ids":   [m["id"]           for m in media],
            "caption":             caption_obj["caption"],
            "hashtags":            caption_obj.get("hashtags", []),
            "status":              "pending_approval",
            "scheduled_at":        scheduled_at,     # ← added
        }).execute().data[0]

        # Bump usage on every member of the carousel
        for m in media:
            supabase.table("media_library").update({
                "times_used":   (m.get("times_used") or 0) + 1,
                "last_used_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", m["id"]).execute()

        return post

    except Exception:
        supabase.rpc("refund_post_quota", {"biz_id": business_id,  "post_type": "carousel"}).execute()
        raise


# ── Generate single AI image into the library ────────────────────────
@router.post("/generateAIImage/{business_id}")
async def generate_ai_image(business_id: str, _: dict = Depends(require_owner_or_admin)):
    return await generate_and_store_image(business_id)


# ── Publish a post to Instagram now ─────────────────────────────────
@router.post("/{post_id}/publish")
def publish_post(post_id: str, _: dict = Depends(require_owner_or_admin)):
    return ig_publish_post(post_id)


# ── Fetch & store post insights ─────────────────────────────────────
@router.post("/{post_id}/insights")
def fetch_insights(post_id: str, _: dict = Depends(require_owner_or_admin)):
    return fetch_and_store_insights(post_id)


# ── Update post (caption edit, attach image, reschedule) ────────────
@router.patch("/{post_id}")
def update_post(post_id: str, body: PostUpdate, _: dict = Depends(require_owner_or_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return supabase.table("posts").select("*").eq("id", post_id).single().execute().data

    result = supabase.table("posts").update(updates).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(404, "Post not found")
    return result.data[0]

@router.delete("/{post_id}")
def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    """Hard delete a not-yet-published post."""
    post = (supabase.table("posts").select("status, business_id").eq("id", post_id).single().execute())

    if not post.data:
        raise HTTPException(404, "Post not found")

    if post.data["status"] == "published":
        raise HTTPException(400, "Published posts can't be deleted here. Remove the post directly on Instagram.", )

    # Ownership check — user must own the business OR be an admin
    biz = (supabase.table("businesses").select("owner_id").eq("id", post.data["business_id"]).single().execute())

    if not biz.data:
        raise HTTPException(404, "Business not found")

    if biz.data["owner_id"] != user["id"]:
        profile = (supabase.table("profiles").select("role").eq("id", user["id"]).single().execute())

        if not profile.data or profile.data.get("role") != "admin":
            raise HTTPException(403, "Not authorized to delete this post.")

        # ── Refund times_used on every member of this post ───────────
    media_ids = post.data.get("media_library_ids") or []
    if media_ids:
        supabase.rpc("decrement_media_usage", {"media_ids": media_ids}).execute()


    # post_insights has FK → posts but no ON DELETE CASCADE; clean up first
    supabase.table("post_insights").delete().eq("post_id", post_id).execute()

    # Then the post itself
    result = supabase.table("posts").delete().eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(404, "Post not found")

    return {"ok": True}

# ── List posts for a business ───────────────────────────────────────
@router.get("/business/{business_id}")
def list_posts(
    business_id: str,
    status: Optional[str] = None,
    _: dict = Depends(require_owner_or_admin),
):
    q = supabase.table("posts").select("*").eq("business_id", business_id)
    if status:
        q = q.eq("status", status)
    return q.order("scheduled_at").execute().data


# ── Helpers ─────────────────────────────────────────────────────────
def _get_business(business_id: str) -> dict:
    resp = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
    if not resp.data:
        raise HTTPException(404, "Business not found")
    return resp.data


def _get_active_ig_page(business_id: str) -> dict:
    resp = (
        supabase.table("instagram_pages")
        .select("id, ig_user_id")
        .eq("business_id", business_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(400, "No active Instagram page connected")
    return resp.data
