from fastapi import APIRouter, HTTPException
from db.client import supabase
from datetime import datetime, timedelta, timezone

router = APIRouter()

@router.get("/{business_id}")
def get_dashboard(business_id: str):
    now       = datetime.now(timezone.utc)
    week_ago  = (now - timedelta(days=7)).isoformat()
    week_from = (now + timedelta(days=7)).isoformat()

    # Business + IG page
    biz = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found")

    ig = supabase.table("instagram_pages").select(
        "ig_username, followers_count, profile_picture_url, is_active, token_expires_at"
    ).eq("business_id", business_id).maybe_single().execute()

    # Posts this week
    # posts_this_week = supabase.table("posts").select("id, status, scheduled_at, caption, ig_permalink").eq(
    #     "business_id", business_id
    # ).gte("scheduled_at", week_ago).lte("scheduled_at", week_from).order("scheduled_at").execute()

    posts_this_week = (
        supabase.table("posts")
        .select("id, status, scheduled_at, caption, ig_permalink")
        .eq("business_id", business_id)
        .gte("scheduled_at", week_ago)
        .order("scheduled_at")
        .execute()
    )

    # Status counts
    all_posts = supabase.table("posts").select("status").eq("business_id", business_id).execute()
    counts    = {"pending": 0, "approved": 0, "scheduled": 0, "published": 0, "failed": 0}
    for p in (all_posts.data or []):
        s = p.get("status", "pending")
        counts[s] = counts.get(s, 0) + 1

    # Latest insights for published posts (last 30 days)
    published = supabase.table("posts").select("id").eq(
        "business_id", business_id
    ).eq("status", "published").execute()
    published_ids = [p["id"] for p in (published.data or [])]

    total_reach = total_likes = total_saves = 0
    if published_ids:
        # Latest insight per post
        insights = supabase.table("post_insights").select(
            "post_id, reach, likes_count, saved, fetched_at"
        ).in_("post_id", published_ids).order("fetched_at", desc=True).execute()

        seen = set()
        for ins in (insights.data or []):
            if ins["post_id"] not in seen:
                seen.add(ins["post_id"])
                total_reach += ins.get("reach", 0)
                total_likes += ins.get("likes_count", 0)
                total_saves += ins.get("saved", 0)

    return {
        "business":          biz.data,
        "instagram_page":    ig.data if ig else None,
        "posts_this_week":   posts_this_week.data if posts_this_week else [],
        "status_counts":     counts,
        "total_published":   counts["published"],
        "total_reach":       total_reach,
        "total_likes":       total_likes,
        "total_saves":       total_saves,
    }
