from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from database import supabase
from config import settings
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

    # Build email HTML
    post_previews = ""
    for p in posts.data:
        image_src = p.get('media_url', 'https://via.placeholder.com/400x400?text=No+Image+Found')
        media_type = p.get('media_type', 'IMAGE')

        # If it's a video, we add the seeker for a thumbnail and a play button overlay
        if media_type == "VIDEO":
            thumbnail_src = f"{image_src}#t=0.1"
            # We wrap the image in a container with a centered Play Button
            media_html = f"""
            <div style="position:relative; width:100%; height:200px; background-color:#000000; border-radius:8px;">
                <img src="{thumbnail_src}" style="width:100%; height:100%; object-fit:cover; opacity:0.8; display:block; border-radius:8px;" />
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);">
                    <table border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td align="center" bgcolor="#1D9E75" style="border-radius:50%; padding:12px;">
                                <img src="https://img.icons8.com/ios-glyphs/30/ffffff/play--v1.png" width="20" height="20" style="display:block;" />
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            """
        else:
            media_html = f'<img src="{image_src}" style="width:100%; height:100%; object-fit:cover; display:block; border-radius:8px;" />'

        post_previews += f"""
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:16px; background-color:#ffffff">
            <div style="width:100%; height:200px; overflow:hidden; border-radius:8px; margin-bottom:12px; background:#f3f4f6">
                <a href="{image_src}" target="_blank" style="text-decoration:none;">
                    {media_html}
                </a>
            </div>
            <p style="font-size:14px; line-height:1.5; color:#374151; margin:0 0 8px; font-family:sans-serif;">
                {p['caption'][:200]}...
            </p>
            <p style="font-size:11px; color:#9ca3af; margin:0; text-transform:uppercase; letter-spacing:0.5px; font-family:sans-serif;">
                📅 {p.get('scheduled_at','')[:16].replace('T',' ')} UTC | 🏷️ {media_type.upper()}
            </p>
        </div>"""

    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:9px;background:#1D9E75;display:flex;align-items:center;justify-content:center">
          <span style="color:white;font-weight:700;font-size:16px">S</span>
        </div>
        <span style="font-size:20px;font-weight:600;color:#111">Socio</span>
      </div>
      <h2 style="font-size:18px;color:#111;margin:0 0 6px">Your posts for this week are ready</h2>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px">
        {len(posts.data)} posts generated for <strong>{biz.data['name']}</strong>. Takes 30 seconds to approve.
      </p>
      {post_previews}
      <a href="{approve_url}" style="display:block;text-align:center;background:#1D9E75;color:white;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-top:8px">
        Approve all {len(posts.data)} posts →
      </a>
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px">
        Or <a href="{settings.FRONTEND_URL}/posts?business={body.business_id}" style="color:#1D9E75">review individually</a>.
        Link expires in 7 days.
      </p>
    </div>"""

    # resend.Emails.send({
    #     "from":    "onboarding@resend.dev",
    #     "to":      [biz.data["owner_email"]],
    #     "subject": f"Your {len(posts.data)} posts for this week are ready ✓",
    #     "html":    html,
    # })
    resend.Emails.send({
        "from":    "onboarding@resend.dev",
        "to":      "snehapatani@gmail.com",
        "subject": f"Your {len(posts.data)} posts for this week are ready ✓",
        "html":    html,
    })


    return {"sent": True, "token": token, "to": biz.data["owner_email"]}


# ── One-click approve via token ───────────────────────────────────────
@router.get("/{token}")
def approve_posts(token: str):
    row = supabase.table("approval_tokens").select("*").eq("token", token).single().execute()
    if not row.data:
        return RedirectResponse(f"{settings.FRONTEND_URL}/approve/invalid")

    t          = row.data
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
