"""Fetch and store IG post insights (likes, reach, saves, etc.)."""

import requests
from fastapi import HTTPException

from core.security import decrypt_token
from db.client import supabase
from services.ig_publisher import GRAPH_API_BASE

INSIGHTS_METRICS = "like_count,comments_count,reach,impressions,saved"


def fetch_and_store_insights(post_id: str) -> dict:
    """Pull current insights from IG, insert a post_insights row."""
    post_resp = (
        supabase.table("posts")
        .select("ig_media_id, instagram_pages(access_token)")
        .eq("id", post_id)
        .eq("status", "published")
        .single()
        .execute()
    )
    if not post_resp.data or not post_resp.data.get("ig_media_id"):
        raise HTTPException(400, "Post not published or no media ID")

    post = post_resp.data
    access_token = decrypt_token(post["instagram_pages"]["access_token_encrypted"])
    ig_media_id = post["ig_media_id"]

    resp = requests.get(
        f"{GRAPH_API_BASE}/{ig_media_id}/insights",
        params={"metric": INSIGHTS_METRICS, "access_token": access_token},
        timeout=10,
    )
    data = resp.json()
    values = {item["name"]: item["values"][0]["value"] for item in data.get("data", [])}

    row = supabase.table("post_insights").insert({
        "post_id":        post_id,
        "likes_count":    values.get("like_count", 0),
        "comments_count": values.get("comments_count", 0),
        "reach":          values.get("reach", 0),
        "impressions":    values.get("impressions", 0),
        "saved":          values.get("saved", 0),
    }).execute()

    return row.data[0]
