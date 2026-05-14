from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from config import settings
from db.client import supabase
from core.security import encrypt_token
import requests, secrets
from datetime import datetime, timedelta, timezone

router = APIRouter()

SCOPE = (
    "instagram_basic,"
    "instagram_content_publish,"
    "instagram_manage_insights,"
    "pages_show_list,"
    "pages_read_engagement"
)

# ── Step 1: redirect to Facebook login ───────────────────────────────
@router.get("/login")
def login(business_id: str):
    """Called when a business owner clicks 'Connect Instagram'."""
    state = f"{business_id}:{secrets.token_urlsafe(16)}"
    url = (
        f"https://www.facebook.com/v21.0/dialog/oauth"
        f"?client_id={settings.FB_APP_ID}"
        f"&redirect_uri={settings.FB_REDIRECT_URI}"
        f"&scope={SCOPE}"
        f"&response_type=code"
        f"&state={state}"
    )
    return RedirectResponse(url)


# ── Step 2: handle callback ───────────────────────────────────────────
@router.get("/callback")
def callback(code: str = None, state: str = None, error: str = None):
    if error or not code:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect?error=denied")

    # Parse state to get business_id
    try:
        business_id = state.split(":")[0]
    except Exception:
        raise HTTPException(400, "Invalid state")

    # A: exchange code → short-lived token
    r = requests.get(
        "https://graph.facebook.com/v21.0/oauth/access_token",
        params={
            "client_id":     settings.FB_APP_ID,
            "client_secret": settings.FB_APP_SECRET,
            "redirect_uri":  settings.FB_REDIRECT_URI,
            "code":          code,
        },
        timeout=10,
    )
    data = r.json()
    if "error" in data:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect?error=token_exchange")
    short_token = data["access_token"]

    # B: upgrade → long-lived token (60 days)
    r2 = requests.get(
        "https://graph.facebook.com/v21.0/oauth/access_token",
        params={
            "grant_type":        "fb_exchange_token",
            "client_id":         settings.FB_APP_ID,
            "client_secret":     settings.FB_APP_SECRET,
            "fb_exchange_token": short_token,
        },
        timeout=10,
    )
    long_data = r2.json()
    long_token = long_data["access_token"]
    expires_in = long_data.get("expires_in", 5183944)  # ~60 days default
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # C: get Facebook Pages the user manages
    pages_r = requests.get(
        "https://graph.facebook.com/v21.0/me/accounts",
        params={"access_token": long_token, "fields": "id,name,access_token"},
        timeout=10,
    )
    pages = pages_r.json().get("data", [])
    if not pages:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect?error=no_pages")

    page = pages[0]
    page_id    = page["id"]
    page_token = page["access_token"]

    # D: get the Instagram Business Account linked to this Page
    ig_r = requests.get(
        f"https://graph.facebook.com/v21.0/{page_id}",
        params={
            "fields":       "instagram_business_account",
            "access_token": page_token,
        },
        timeout=10,
    )
    ig_data = ig_r.json()
    ig_account = ig_data.get("instagram_business_account")
    if not ig_account:
        return RedirectResponse(f"{settings.FRONTEND_URL}/connect?error=no_ig_account")

    ig_user_id = ig_account["id"]

    # E: fetch IG profile details
    profile_r = requests.get(
        f"https://graph.facebook.com/v21.0/{ig_user_id}",
        params={
            "fields":       "username,followers_count,profile_picture_url",
            "access_token": long_token,
        },
        timeout=10,
    )
    profile = profile_r.json()

    # F: upsert into instagram_pages
    supabase.table("instagram_pages").upsert({
        "business_id":          business_id,
        "ig_user_id":           ig_user_id,
        "ig_username":          profile.get("username"),
        "fb_page_id":           page_id,
        "fb_page_name":         page.get("name"),
        "access_token_encrypted":encrypt_token(long_token),
        "token_expires_at":     expires_at.isoformat(),
        "followers_count":      profile.get("followers_count", 0),
        "profile_picture_url":  profile.get("profile_picture_url"),
        "is_active":            True,
    }, on_conflict="ig_user_id").execute()

    return RedirectResponse(f"{settings.FRONTEND_URL}/?connected=true")
