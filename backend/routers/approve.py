from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from db.client import supabase
from config import settings
from services.email_builder import approval_email, FROM_EMAIL
import secrets, resend
from datetime import datetime, timedelta, timezone

router   = APIRouter()
resend.api_key = settings.RESEND_API_KEY   # set via env — see services/email.py

# ── Generate approval token + send digest email ───────────────────────
class ApprovalRequest(BaseModel):
    business_id: str
    post_ids: list[str]

@router.post("/send")
def send_approval_email(body: ApprovalRequest):
    # Fetch pending posts
    posts = supabase.table("posts").select("*").in_("id", body.post_ids).execute()
    if not posts.data:
        raise HTTPException(404, "No posts found")

    # Fetch business email
    biz = supabase.table("businesses").select("name, owner_email").eq(
        "id", body.business_id
    ).single().execute()
    if not biz.data:
        raise HTTPException(404, "Business not found")

    # Create token
    token      = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    supabase.table("approval_tokens").insert({
        "token":        token,
        "business_id":  body.business_id,
        "post_ids":     body.post_ids,
        "expires_at":   expires_at.isoformat(),
    }).execute()

    approve_url = f"{settings.FRONTEND_URL}/approve/{token}"

    subject, html = approval_email(
        posts=posts.data,
        biz_name=biz.data["name"],
        approve_url=approve_url,
        frontend_url=settings.FRONTEND_URL,
    )

    resend.Emails.send({
        "from":    FROM_EMAIL,
        "to":      "snehapatani@gmail.com",
        "subject": subject,
        "html":    html,
    })


    return {"sent": True, "token": token, "to": biz.data["owner_email"]}


# ── One-click approve via token ───────────────────────────────────────
@router.get("/{token}")
def approve_posts(token: str):
    # Use limit(1) instead of .single() — single() raises an exception on 0 rows
    rows = supabase.table("approval_tokens").select("*").eq("token", token).limit(1).execute()
    if not rows.data:
        return RedirectResponse(f"{settings.FRONTEND_URL}/approve/invalid")

    t          = rows.data[0]
    expires_at = datetime.fromisoformat(t["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        return RedirectResponse(f"{settings.FRONTEND_URL}/approve/expired")

    if t.get("used_at"):
        return RedirectResponse(f"{settings.FRONTEND_URL}/approve/already-used")

    # Mark token used
    supabase.table("approval_tokens").update({
        "used_at": datetime.now(timezone.utc).isoformat()
    }).eq("token", token).execute()

    # Approve all posts in this token
    supabase.table("posts").update({"status": "approved"}).in_(
        "id", t["post_ids"]
    ).execute()

    return RedirectResponse(
        f"{settings.FRONTEND_URL}/approve/success?count={len(t['post_ids'])}&business={t['business_id']}"
    )
