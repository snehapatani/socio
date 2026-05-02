from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import supabase, decrypt_token
from config import settings
from typing import Optional
import time
import uuid
import anthropic, json, requests
from google import genai
from google.genai import types
from datetime import datetime, timedelta, timezone

router = APIRouter()
claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
# Configure Google AI (Gemini/Nano)
client = genai.Client(api_key=settings.GOOGLE_API_KEY, http_options=types.HttpOptions(api_version='v1beta'))

import logging
log = logging.getLogger("socio.scheduler")
from collections import defaultdict

def get_best_schedule(business_id: str) -> list:
    """
    Analyse past post_insights to find top 3 day+hour slots by reach.
    Falls back to Mon/Wed/Fri 18:00/12:00/17:00 if not enough data.
    """
    FALLBACK = [
        (0, 18),  # Monday 6pm
        (2, 12),  # Wednesday 12pm
        (4, 17),  # Friday 5pm
    ]

    # Need at least 6 published posts with insights to make a meaningful analysis
    published = supabase.table("posts").select("id, scheduled_at").eq(
        "business_id", business_id
    ).eq("status", "published").execute()

    if not published.data or len(published.data) < 6:
        #log.info(f"Not enough data for {business_id}, using fallback schedule")
        return _build_schedule(FALLBACK)

    post_ids = [p["id"] for p in published.data]
    post_times = {p["id"]: p["scheduled_at"] for p in published.data}

    # Get latest insight per post
    insights = supabase.table("post_insights").select(
        "post_id, reach, saved, fetched_at"
    ).in_("post_id", post_ids).order("fetched_at", desc=True).execute()

    seen = set()
    slot_scores = defaultdict(list)

    for ins in (insights.data or []):
        pid = ins["post_id"]
        if pid in seen:
            continue
        seen.add(pid)

        ts = post_times.get(pid)
        if not ts:
            continue

        dt      = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        weekday = dt.weekday()   # 0=Mon … 6=Sun
        hour    = (dt.hour // 3) * 3  # bucket into 3-hour windows

        # Score = reach + (saves × 3)  — saves signal high-quality content
        score = ins.get("reach", 0) + (ins.get("saved", 0) * 3)
        slot_scores[(weekday, hour)].append(score)

    if not slot_scores:
        return _build_schedule(FALLBACK)

    # Average score per slot, pick top 3 distinct days
    avg_scores = {
        slot: sum(scores) / len(scores)
        for slot, scores in slot_scores.items()
    }
    ranked = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)

    chosen = []
    used_days = set()
    for (weekday, hour), _ in ranked:
        if weekday not in used_days:
            chosen.append((weekday, hour))
            used_days.add(weekday)
        if len(chosen) == 3:
            break

    # Fill remaining slots from fallback if needed
    for day, hour in FALLBACK:
        if len(chosen) == 3:
            break
        if day not in used_days:
            chosen.append((day, hour))
            used_days.add(day)

    chosen.sort(key=lambda x: x[0])  # sort by day of week
    return _build_schedule(chosen)


def _build_schedule(day_hour_pairs: list) -> list:
    """Turn (weekday, hour) pairs into UTC datetimes for next week."""
    now  = datetime.now(timezone.utc)
    # Start of next Monday
    days_until_monday = (7 - now.weekday()) % 7 or 7
    next_monday = (now + timedelta(days=days_until_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    schedule = []
    for weekday, hour in day_hour_pairs:
        dt = next_monday + timedelta(days=weekday, hours=hour)
        schedule.append(dt)
    return schedule

async def generate_image_async(prompt: str):
    print(f"🎨 Sending prompt to Imagen 4.0: {prompt[:50]}...")
    try:
        response = await client.aio.models.generate_images(
            model='models/imagen-4.0-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1)
        )
        print("✅ Image generation complete!")
        return response.generated_images[0].image.image_bytes
    except Exception as e:
        print(f"❌ Gemini Error: {e}")
        raise e

@router.post("/generateAIImage/{business_id}")
async def generate_ai_image(business_id: str):
    # 1. Fetch business brand context
    biz = supabase.table("businesses").select("*").eq(
        "id", business_id
    ).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found")
    b = biz.data

    # 2. Fetch active IG page
    ig = supabase.table("instagram_pages").select(
        "id, ig_user_id"
    ).eq("business_id", business_id).eq("is_active", True).single().execute()
    if not ig.data:
        raise HTTPException(400, "No active Instagram page connected")

    ctx = b.get("business_context", "modern")
    ctx_text = "\n".join(f"- {k}: {v}" for k, v in ctx.items()) if ctx else "No additional context."
    business_type = b.get("business_type", "lifestyle")

    prompt = f"High-quality professional social media photography for a {business_type} business. Style: {ctx_text}. Vibrant, clean, square aspect ratio, no text."
    image_bytes = await generate_image_async(prompt)

    media_id = str(uuid.uuid4())
    path     = f"businesses/{business_id}/library/{media_id}.jpeg"

    supabase.storage.from_("media").upload(
        path=path,
        file=image_bytes,
        file_options={"content-type": "image/jpeg"},
    )

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"

    row = supabase.table("media_library").insert({
        "business_id":  business_id,
        "media_url":    public_url,
        "storage_path": path,
        "times_used":   0,
        "is_active":    True,
    }).execute()

    return {"media_url": public_url, "media_storage_path": path, "business_id": business_id}

@router.post("/generate/{business_id}")
def generate_posts(business_id: str):
    # 1. Fetch business brand context
    biz = supabase.table("businesses").select("*").eq(
        "id", business_id
    ).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found")
    b = biz.data

    # 2. Fetch active IG page
    ig = supabase.table("instagram_pages").select(
        "id, ig_user_id"
    ).eq("business_id", business_id).eq("is_active", True).single().execute()
    if not ig.data:
        raise HTTPException(400, "No active Instagram page connected")



    media = pick_media_for_generation(business_id)

    if len(media) < 3:
        raise HTTPException(400, f"Need 3 photos to generate posts. Only {len(media)} uploaded.")

    # 4. Get best schedule based on past engagement
    schedule = get_best_schedule(business_id)

    # 5. Build Claude prompt — one message per photo using vision
    ctx      = b.get("business_context") or {}
    ctx_text = "\n".join(f"- {k}: {v}" for k, v in ctx.items()) if ctx else "No additional context."

    system_prompt = f"""You are a social media manager for a {b.get('business_type', 'business')}.

Business name: {b['name']}
Brand tone: {b.get('brand_tone', 'warm and friendly')}
Additional context:
{ctx_text}

You will be given 3 photos. Write one Instagram post for each photo.
Respond ONLY with a JSON array of exactly 3 objects. No markdown, no preamble.
Format:
[
  {{
    "caption": "Full caption text — engaging, on-brand, ends with a soft CTA",
    "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }}
]"""

    # Build content array: text instruction + 3 images
    content = [
        {
            "type": "text",
            "text": "Write one Instagram caption for each of these 3 photos, in order."
        }
    ]
    for i, photo in enumerate(media[:3]):
        content.append({
            "type": "text",
            "text": f"Photo {i + 1}:"
        })
        content.append({
            "type": "image",
            "source": {
                "type": "url",
                "url":  photo["media_url"],
            }
        })

    # message = claude.messages.create(
    #     model="claude-sonnet-4-20250514",
    #     max_tokens=1000,
    #     system=system_prompt,
    #     messages=[{"role": "user", "content": content}],
    # )

    # raw = message.content[0].text.strip()
    # if raw.startswith("```"):
    #     raw = raw.split("```")[1]
    #     if raw.startswith("json"):
    #         raw = raw[4:]
    # generated = json.loads(raw.strip())

    generated = [
        {
            "caption": "Mornings are best spent like this! Snuggled up close with your mini-me on a cozy rug, just enjoying the simple moments together. 🥰 From spontaneous giggles to soft hugs, there’s nothing quite like that mother-daughter bond. My heart is so full. What does your perfect morning look like? 🧸❤️✨",
            "hashtags": ["MotherDaughterLove", "MomLife", "SnuggleSeason",
                         "HappyMoments", "CozyVibes","TwinningInCozy",
                        "MyEverything", "LoveAndLaughter",
                        "LittleMomentsBigMemories", "HeartFull",
                        "ParentingJoy", "RugSnugs",
                        "FamilyOverEverything", "CherishTheTime"]
        },
        {
            "caption": "Mornings are best spent like this! Snuggled up close with your mini-me on a cozy rug, just enjoying the simple moments together. 🥰 From spontaneous giggles to soft hugs, there’s nothing quite like that mother-daughter bond. My heart is so full. What does your perfect morning look like? 🧸❤️✨",
            "hashtags": ["MotherDaughterLove", "MomLife", "SnuggleSeason",
                         "HappyMoments", "CozyVibes","TwinningInCozy",
                        "MyEverything", "LoveAndLaughter",
                        "LittleMomentsBigMemories", "HeartFull",
                        "ParentingJoy", "RugSnugs",
                        "FamilyOverEverything", "CherishTheTime"]
        },
        {
            "caption": "Mornings are best spent like this! Snuggled up close with your mini-me on a cozy rug, just enjoying the simple moments together. 🥰 From spontaneous giggles to soft hugs, there’s nothing quite like that mother-daughter bond. My heart is so full. What does your perfect morning look like? 🧸❤️✨",
            "hashtags": ["MotherDaughterLove", "MomLife", "SnuggleSeason",
                         "HappyMoments", "CozyVibes","TwinningInCozy",
                        "MyEverything", "LoveAndLaughter",
                        "LittleMomentsBigMemories", "HeartFull",
                        "ParentingJoy", "RugSnugs",
                        "FamilyOverEverything", "CherishTheTime"]
        }
    ]
    # 6. Insert posts — each tied to its photo
    inserted = []
    for i, post in enumerate(generated[:3]):
        mediaPost = media[i]
        mediaType =   'IMAGE'
        if(mediaPost["content_type"] == 'video/mp4'):
            mediaType =   'VIDEO'

        row = supabase.table("posts").insert({
            "business_id":        business_id,
            "ig_page_id":         ig.data["id"],
            "caption":            post["caption"],
            "hashtags":           post.get("hashtags", []),
            "media_type":         mediaType,
            "media_url":          mediaPost["media_url"],       # already set from upload
            "media_storage_path": mediaPost["storage_path"],
            "status":             "pending",
            "scheduled_at":       schedule[i].isoformat(),
        }).execute()
        inserted.append(row.data[0])

        # AFTER inserting post, update media_library usage count
        supabase.table("media_library").update({
            "times_used":   mediaPost["times_used"] + 1,
            "last_used_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", mediaPost["id"]).execute()

        # Also save the link on the post row
        supabase.table("posts").update({
            "media_library_id": mediaPost["id"]
        }).eq("id", row.data[0]["id"]).execute()

    return {"generated": len(inserted), "posts": inserted}


def pick_media_for_generation(business_id: str) -> list:
    """
    Pick 3 photos for this week's posts.
    Priority:
      1. New photos (times_used = 0) — always prefer fresh content
      2. High-performing photos (reach + saves) — reuse if not enough new ones
    Never reuse a photo used in the last 4 weeks.
    """
    four_weeks_ago = (
        datetime.now(timezone.utc) - timedelta(weeks=4)
    ).isoformat()

    # All active photos for this business
    all_media = supabase.table("media_library").select(
        "id, media_url, storage_path, times_used, last_used_at", "content_type"
    ).eq("business_id", business_id).eq("is_active", True).execute()

    photos = all_media.data or []
    if not photos:
        raise HTTPException(
            400, "No photos in library. Upload photos before generating posts."
        )

    # Split into fresh vs reusable
    fresh = [
        p for p in photos
        if p["times_used"] == 0
    ]
    reusable = [
        p for p in photos
        if p["times_used"] > 0
        and (not p["last_used_at"] or p["last_used_at"] < four_weeks_ago)
    ]

    # Score reusable photos by past engagement
    if reusable:
        reusable = _score_photos_by_engagement(business_id, reusable)

    # Build selection: fresh first, top performers to fill gaps
    selected = fresh[:3]
    if len(selected) < 3:
        needed   = 3 - len(selected)
        selected += reusable[:needed]

    if len(selected) < 3:
        raise HTTPException(
            400,
            f"Not enough photos available. "
            f"You have {len(selected)} — need 3. "
            f"Upload more or wait 4 weeks to reuse recent photos."
        )

    return selected[:3]


def _score_photos_by_engagement(business_id: str, photos: list) -> list:
    """Sort photos by average reach+saves of their past posts."""
    photo_ids = [p["id"] for p in photos]

    # Get all posts that used these photos
    posts = supabase.table("posts").select(
        "id, media_library_id"
    ).in_("media_library_id", photo_ids).eq("status", "published").execute()

    if not posts.data:
        return photos  # no data yet, return unsorted

    post_ids    = [p["id"] for p in posts.data]
    photo_posts = {p["id"]: p["media_library_id"] for p in posts.data}

    # Get latest insight per post
    insights = supabase.table("post_insights").select(
        "post_id, reach, saved, fetched_at"
    ).in_("post_id", post_ids).order("fetched_at", desc=True).execute()

    seen           = set()
    photo_scores   = defaultdict(list)

    for ins in (insights.data or []):
        pid = ins["post_id"]
        if pid in seen:
            continue
        seen.add(pid)
        photo_id = photo_posts.get(pid)
        if photo_id:
            score = ins.get("reach", 0) + (ins.get("saved", 0) * 3)
            photo_scores[photo_id].append(score)

    # Attach avg score to each photo
    for p in photos:
        scores   = photo_scores.get(p["id"], [0])
        p["_score"] = sum(scores) / len(scores)

    return sorted(photos, key=lambda x: x.get("_score", 0), reverse=True)

# ── Update post (caption edit / attach image) ─────────────────────────
class PostUpdate(BaseModel):
    caption:    Optional[str] = None
    media_url:  Optional[str] = None
    media_storage_path: Optional[str] = None
    scheduled_at: Optional[str] = None

@router.patch("/{post_id}")
def update_post(post_id: str, body: PostUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = supabase.table("posts").update(updates).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(404, "Post not found")
    return result.data[0]


# ── List posts for a business ─────────────────────────────────────────
@router.get("/business/{business_id}")
def list_posts(business_id: str, status: Optional[str] = None):
    q = supabase.table("posts").select("*").eq("business_id", business_id)
    if status:
        q = q.eq("status", status)
    result = q.order("scheduled_at").execute()
    return result.data


# ── Publish a single post NOW (called by scheduler) ───────────────────
@router.post("/{post_id}/publish")
def publish_post(post_id: str):
    post = supabase.table("posts").select("*, instagram_pages(*)").eq(
        "id", post_id
    ).single().execute()
    if not post.data:
        raise HTTPException(404, "Post not found")
    p  = post.data
    ig = p["instagram_pages"]
    media_type = p.get("media_type", "image") # Default to image if not set

    if not p.get("media_url"):
        raise HTTPException(400, "Post has no media_url — upload an image first")

    access_token = decrypt_token(ig["access_token"])
    ig_user_id   = ig["ig_user_id"]
    caption      = p["caption"] + "\n\n" + " ".join(f"#{h}" for h in (p.get("hashtags") or []))

    container_params = {
        "caption": caption,
        "access_token": access_token,
    }

    if media_type == "VIDEO":
        container_params["media_type"] = "REELS"
        container_params["video_url"] = p["media_url"]
    else:
        container_params["image_url"] = p["media_url"]

    # Step 1: create media container
    container_r = requests.post(
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media",
        params=container_params,
        timeout=30,
    )

    container = container_r.json()
    if "error" in container:
        supabase.table("posts").update({
            "status": "failed",
            "error_message": json.dumps(container["error"]),
        }).eq("id", post_id).execute()
        raise HTTPException(502, f"Meta container error: {container['error']}")

    container_id = container["id"]

    max_retries = 15 if media_type == "video" else 5
    is_ready = False

    for i in range(max_retries):
        # Check the status of the container
        status_r = requests.get(
            f"https://graph.facebook.com/v21.0/{container_id}",
            params={"fields": "status_code", "access_token": access_token},
            timeout=10
        )
        status_data = status_r.json()
        status_code = status_data.get("status_code")

        if status_code == "FINISHED":
            is_ready = True
            break
        elif status_code == "ERROR":
            # Something is actually wrong with the image (e.g. aspect ratio)
            error_msg = status_data.get("status", "Meta processing failed")
            raise HTTPException(502, f"Meta processing error: {error_msg}")

        log.info(f"Container {container_id} is {status_code}. Waiting 10s... ({i+1}/{max_retries})")
        time.sleep(10) # 10 seconds is the "sweet spot" for Meta ingestion

    if not is_ready:
        raise HTTPException(504, "Meta is taking too long to process. The scheduler will try again later.")

    # Step 2: publish container
    publish_r = requests.post(
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media_publish",
        params={
            "creation_id":  container_id,
            "access_token": access_token,
        },
        timeout=30,
    )
    pub = publish_r.json()
    if "error" in pub:
        supabase.table("posts").update({
            "status": "failed",
            "error_message": json.dumps(pub["error"]),
        }).eq("id", post_id).execute()
        raise HTTPException(502, f"Meta publish error: {pub['error']}")

    ig_media_id = pub["id"]

    # Fetch permalink
    link_r  = requests.get(
        f"https://graph.facebook.com/v21.0/{ig_media_id}",
        params={"fields": "permalink", "access_token": access_token},
        timeout=10,
    )
    permalink = link_r.json().get("permalink", "")

    supabase.table("posts").update({
        "status":       "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "ig_media_id":  ig_media_id,
        "ig_permalink": permalink,
    }).eq("id", post_id).execute()

    return {"published": True, "ig_media_id": ig_media_id, "permalink": permalink}


# ── Fetch & store insights for a published post ───────────────────────
@router.post("/{post_id}/insights")
def fetch_insights(post_id: str):
    post = supabase.table("posts").select("ig_media_id, instagram_pages(access_token)").eq(
        "id", post_id
    ).eq("status", "published").single().execute()
    if not post.data or not post.data.get("ig_media_id"):
        raise HTTPException(400, "Post not published or no media ID")

    p            = post.data
    access_token = decrypt_token(p["instagram_pages"]["access_token"])
    ig_media_id  = p["ig_media_id"]

    ins_r = requests.get(
        f"https://graph.facebook.com/v21.0/{ig_media_id}/insights",
        params={
            "metric":       "like_count,comments_count,reach,impressions,saved",
            "access_token": access_token,
        },
        timeout=10,
    )
    ins_data = {item["name"]: item["values"][0]["value"] for item in ins_r.json().get("data", [])}

    row = supabase.table("post_insights").insert({
        "post_id":        post_id,
        "likes_count":    ins_data.get("like_count", 0),
        "comments_count": ins_data.get("comments_count", 0),
        "reach":          ins_data.get("reach", 0),
        "impressions":    ins_data.get("impressions", 0),
        "saved":          ins_data.get("saved", 0),
    }).execute()

    return row.data[0]
