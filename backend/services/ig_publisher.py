"""Instagram Graph API publishing.

Handles three flows:
  - Single image / Reel (video)
  - Carousel (2-10 child items)

Each publish is a 3-phase dance:
  1. Create container(s) for the media
  2. (If video) Wait for IG to finish processing
  3. POST /media_publish with the final creation_id
"""

import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import HTTPException

from core.security import decrypt_token
from db.client import supabase

log = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE    = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Polling settings for container readiness
POLL_INTERVAL_SEC      = 10
POLL_MAX_ATTEMPTS_IMG  = 5
POLL_MAX_ATTEMPTS_VID  = 15


# ── Container creation ─────────────────────────────────────────────
def create_media_container(
    ig_user_id: str,
    access_token: str,
    media_url: str,
    *,
    caption: Optional[str]    = None,
    media_type: str           = "IMAGE",   # "IMAGE" | "VIDEO"
    is_carousel_item: bool    = False,
) -> str:
    """Create a single media container. Returns the container ID."""
    params: dict = {
        "access_token":     access_token,
        "is_carousel_item": "true" if is_carousel_item else "false",
    }

    if media_type == "VIDEO":
        params["video_url"] = media_url
        params["media_type"] = "REELS"
    else:
        params["image_url"] = media_url

    if caption and not is_carousel_item:
        params["caption"] = caption

    resp = requests.post(f"{GRAPH_API_BASE}/{ig_user_id}/media", params=params, timeout=30)
    data = resp.json()

    if "error" in data:
        raise IGError("container_create_failed", data["error"])
    return data["id"]


def create_carousel_container(
    ig_user_id: str,
    access_token: str,
    child_ids: list[str],
    caption: str,
) -> str:
    """Create the parent CAROUSEL container. Returns its ID."""
    params = {
        "access_token": access_token,
        "media_type":   "CAROUSEL",
        "children":     ",".join(child_ids),
        "caption":      caption,
    }
    resp = requests.post(f"{GRAPH_API_BASE}/{ig_user_id}/media", params=params, timeout=30)
    data = resp.json()
    if "error" in data:
        raise IGError("carousel_create_failed", data["error"])
    return data["id"]


# ── Polling for readiness ──────────────────────────────────────────
def wait_for_container_ready(
    container_id: str,
    access_token: str,
    *,
    is_video: bool = False,
) -> None:
    """Poll the container until status_code == FINISHED.

    Raises IGError on ERROR or timeout.
    """
    max_attempts = POLL_MAX_ATTEMPTS_VID if is_video else POLL_MAX_ATTEMPTS_IMG

    for attempt in range(max_attempts):
        resp = requests.get(
            f"{GRAPH_API_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": access_token},
            timeout=10,
        )
        data = resp.json()
        code = data.get("status_code")

        if code == "FINISHED":
            return
        if code == "ERROR":
            raise IGError("processing_error", data.get("status", "Meta processing failed"))

        log.info(
            "Container %s is %s. Waiting %ds (%d/%d)",
            container_id, code, POLL_INTERVAL_SEC, attempt + 1, max_attempts,
        )
        time.sleep(POLL_INTERVAL_SEC)

    raise IGError("processing_timeout", "Meta is taking too long to process this media.")


# ── Publish + permalink fetch ──────────────────────────────────────
def publish_container(ig_user_id: str, access_token: str, container_id: str) -> str:
    """Publish a ready container. Returns the IG media ID."""
    resp = requests.post(
        f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
        params={"creation_id": container_id, "access_token": access_token},
        timeout=30,
    )
    data = resp.json()
    if "error" in data:
        raise IGError("publish_failed", data["error"])
    return data["id"]


def get_permalink(ig_media_id: str, access_token: str) -> str:
    resp = requests.get(
        f"{GRAPH_API_BASE}/{ig_media_id}",
        params={"fields": "permalink", "access_token": access_token},
        timeout=10,
    )
    return resp.json().get("permalink", "")


# ── Orchestration: full publish flow for a post ────────────────────
def publish_post(post_id: str) -> dict:
    """Fetch the post, run the IG publish flow, update DB.

    Handles single-image, single-video (Reel), and carousel.
    """
    post_resp = (
        supabase.table("posts")
        .select("*, instagram_pages(*)")
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not post_resp.data:
        raise HTTPException(404, "Post not found")

    post = post_resp.data
    ig = post["instagram_pages"]
    urls = post.get("media_urls") or []
    if not urls:
        raise HTTPException(400, "Post has no media — upload media first")

    access_token = decrypt_token(ig["access_token_encrypted"])
    ig_user_id   = ig["ig_user_id"]
    caption      = _compose_caption(post)
    media_type   = (post.get("media_type") or "IMAGE").upper()
    is_video     = media_type == "VIDEO"

    try:
        if media_type == "CAROUSEL" or len(urls) > 1:
            container_id = _create_carousel(ig_user_id, access_token, urls, caption)
            # NOTE: for video children inside a carousel, IG also needs each
            # child container to be FINISHED before adding to the parent.
            # Add per-child wait_for_container_ready calls inside _create_carousel
            # if you start mixing video into carousels.
        else:
            container_id = create_media_container(
                ig_user_id, access_token, urls[0],
                caption=caption,
                media_type="VIDEO" if is_video else "IMAGE",
            )

        wait_for_container_ready(container_id, access_token, is_video=is_video)
        ig_media_id = publish_container(ig_user_id, access_token, container_id)
        permalink   = get_permalink(ig_media_id, access_token)

    except IGError as e:
        _mark_failed(post_id, e.detail)
        raise HTTPException(502, f"Instagram error ({e.code}): {e.detail}")

    supabase.table("posts").update({
        "status":       "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "ig_media_id":  ig_media_id,
        "ig_permalink": permalink,
    }).eq("id", post_id).execute()

    return {"published": True, "ig_media_id": ig_media_id, "permalink": permalink}


# ── Internals ──────────────────────────────────────────────────────
def _compose_caption(post: dict) -> str:
    base = post.get("caption") or ""
    tags = post.get("hashtags") or []
    if tags:
        return base + "\n\n" + " ".join(f"#{h}" for h in tags)
    return base


def _create_carousel(ig_user_id: str, access_token: str, urls: list[str], caption: str) -> str:
    child_ids: list[str] = []
    for url in urls:
        is_video = _looks_like_video(url)
        cid = create_media_container(
            ig_user_id, access_token, url,
            media_type="VIDEO" if is_video else "IMAGE",
            is_carousel_item=True,
        )
        if is_video:
            # Wait for each video child before composing the parent
            wait_for_container_ready(cid, access_token, is_video=True)
        child_ids.append(cid)
    return create_carousel_container(ig_user_id, access_token, child_ids, caption)


def _looks_like_video(url: str) -> bool:
    return any(url.lower().split("?")[0].endswith(ext) for ext in (".mp4", ".mov", ".m4v"))


def _mark_failed(post_id: str, detail) -> None:
    supabase.table("posts").update({
        "status":        "failed",
        "error_message": json.dumps(detail) if isinstance(detail, (dict, list)) else str(detail),
    }).eq("id", post_id).execute()


# ── Custom exception ───────────────────────────────────────────────
class IGError(Exception):
    def __init__(self, code: str, detail):
        self.code = code
        self.detail = detail
        super().__init__(f"{code}: {detail}")
