"""Selecting which photos/videos to use for generation.

Priority:
  1. Fresh media never used before
  2. High-performing media (reach + 3×saves) not used in the last 4 weeks
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from db.client import supabase

COOLDOWN_WEEKS = 4


def pick_media_for_generation(business_id: str, count: int = 3) -> list:
    """Pick `count` photos for this week's posts.

    Raises HTTPException(400) if not enough media available.
    """
    cooldown_cutoff = (datetime.now(timezone.utc) - timedelta(weeks=COOLDOWN_WEEKS)).isoformat()

    result = (
        supabase.table("media_library")
        .select("id, media_url, storage_path, times_used, last_used_at, content_type")
        .eq("business_id", business_id)
        .eq("is_active", True)
        .execute()
    )
    photos = result.data or []

    if not photos:
        raise HTTPException(
            400,
            "No photos in library. Upload photos before generating posts.",
        )

    fresh = [p for p in photos if (p.get("times_used") or 0) == 0]
    reusable = [
        p for p in photos
        if (p.get("times_used") or 0) > 0
        and (not p.get("last_used_at") or p["last_used_at"] < cooldown_cutoff)
    ]

    if reusable:
        reusable = _score_photos_by_engagement(business_id, reusable)

    selected = fresh[:count]
    if len(selected) < count:
        needed = count - len(selected)
        selected += reusable[:needed]

    if len(selected) < count:
        raise HTTPException(
            400,
            f"Not enough photos available. You have {len(selected)} — need {count}. "
            f"Upload more or wait {COOLDOWN_WEEKS} weeks to reuse recent photos.",
        )

    return selected[:count]


def _score_photos_by_engagement(business_id: str, photos: list) -> list:
    """Sort photos by average (reach + 3×saves) of their past posts.

    For carousels, each member photo inherits the post's insights —
    a 1000-reach carousel boosts the score of every photo it contained.
    """
    photo_ids = [p["id"] for p in photos]

    # Find published posts whose media_library_ids overlaps our photo set
    posts = (
        supabase.table("posts")
        .select("id, media_library_ids")
        .overlaps("media_library_ids", photo_ids)
        .eq("status", "published")
        .execute()
    )
    if not posts.data:
        return photos

    post_ids    = [p["id"] for p in posts.data]
    # Map: post_id → list of photo_ids that post used
    post_photos = {p["id"]: (p["media_library_ids"] or []) for p in posts.data}

    insights = (
        supabase.table("post_insights")
        .select("post_id, reach, saved, fetched_at")
        .in_("post_id", post_ids)
        .order("fetched_at", desc=True)
        .execute()
    )

    photo_scores: dict[str, list[int]] = defaultdict(list)
    seen: set[str] = set()
    for ins in (insights.data or []):
        pid = ins["post_id"]
        if pid in seen:
            continue
        seen.add(pid)

        score = (ins.get("reach") or 0) + (ins.get("saved") or 0) * 3
        # Apply to every photo the post contained (handles carousels)
        for photo_id in post_photos.get(pid, []):
            if photo_id in photo_ids:    # only score photos we asked about
                photo_scores[photo_id].append(score)

    for p in photos:
        scores = photo_scores.get(p["id"], [0])
        p["_score"] = sum(scores) / len(scores)

    return sorted(photos, key=lambda x: x.get("_score", 0), reverse=True)
