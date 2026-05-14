from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from database import supabase
from routers.posts import generate_posts, publish_post
from datetime import datetime, timezone
import logging
import resend as resend_client
from config import settings

log = logging.getLogger("socio.scheduler")

def job_generate_all():
    """Every Sunday 20:00 UTC — generate 3 posts for every active business."""
    log.info("Running weekly post generation...")
    businesses = supabase.table("businesses").select("id").execute()
    for biz in (businesses.data or []):
        try:
            result = generate_posts(biz["id"])
            log.info(f"Generated {result['generated']} posts for {biz['id']}")
        except Exception as e:
            log.error(f"Generation failed for {biz['id']}: {e}")


def job_publish_due():
    """Every minute — publish approved posts whose scheduled_at has passed."""
    now = datetime.now(timezone.utc).isoformat()
    due = supabase.table("posts").select("id").eq("status", "approved").lte(
        "scheduled_at", now
    ).execute()

    for post in (due.data or []):
        try:
            result = publish_post(post["id"])
            log.info(f"Published post {post['id']} → {result.get('permalink')}")
        except Exception as e:
            log.error(f"Publish failed for post {post['id']}: {e}")


def job_refresh_tokens():
    """Every day — refresh tokens expiring within 7 days."""
    from routers.auth import refresh_token   # imported here to avoid circular
    from datetime import timedelta
    soon = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    expiring = supabase.table("instagram_pages").select(
        "id, access_token"
    ).lte("token_expires_at", soon).eq("is_active", True).execute()

    for page in (expiring.data or []):
        try:
            refresh_token(page["id"], page["access_token"])
            log.info(f"Token refreshed for IG page {page['id']}")
        except Exception as e:
            log.error(f"Token refresh failed for {page['id']}: {e}")


def start_scheduler():
    scheduler = BackgroundScheduler(timezone=settings.TZ)

    # Generate posts every Sunday at 20:00 UTC
    scheduler.add_job(job_generate_all, CronTrigger(day_of_week="sun", hour=20, minute=0))

    # Publish due posts every minute
    scheduler.add_job(job_publish_due, CronTrigger(minute="*"))

    # Refresh expiring tokens every day at 03:00 UTC
    scheduler.add_job(job_refresh_tokens, CronTrigger(hour=3, minute=0))

    # Photo reminder: Sunday 10:00 UTC (10 hours before generation)
    scheduler.add_job(job_photo_reminder, CronTrigger(day_of_week="mon", hour=13, minute=7))

    scheduler.start()
    log.info("Scheduler started — 3 jobs running")
    return scheduler

# Add this new job function
def job_photo_reminder():
    """
    Every Sunday 10:00 UTC — remind owners to upload photos
    if they haven't already uploaded 3 this week.
    """

    resend_client.api_key = settings.RESEND_API_KEY

    pages = supabase.table("instagram_pages").select(
        "business_id"
    ).eq("is_active", True).execute()

    for page in (pages.data or []):
        bid = page["business_id"]
        try:
            # Check how many unused photos they have
            pending = supabase.table("media_library").select("id").eq(
                "business_id", bid
            ).eq("times_used", 0).execute()

            count = len(pending.data or [])
            if count >= 3:
                log.info(f"Business {bid} already has 3 photos — skipping reminder")
                continue

            needed = 3 - count

            # Fetch owner email
            biz = supabase.table("businesses").select(
                "name, owner_email"
            ).eq("id", bid).single().execute()
            if not biz.data:
                continue

            name  = biz.data["name"]
            email = biz.data["owner_email"]
            upload_url = f"{settings.FRONTEND_URL}/?upload=true"

            html = f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
                <div style="width:32px;height:32px;border-radius:8px;background:#1D9E75;
                            display:flex;align-items:center;justify-content:center">
                  <span style="color:white;font-weight:700;font-size:15px">S</span>
                </div>
                <span style="font-size:18px;font-weight:600;color:#111">Socio</span>
              </div>

              <h2 style="font-size:17px;color:#111;margin:0 0 8px">
                Upload {needed} photo{"s" if needed > 1 else ""} for next week
              </h2>
              <p style="font-size:14px;color:#6b7280;margin:0 0 6px">
                Hi! Socio will generate next week's posts for <strong>{name}</strong>
                tonight at 8pm — but we need {needed} more photo{"s" if needed > 1 else ""} first.
              </p>
              <p style="font-size:13px;color:#9ca3af;margin:0 0 24px">
                {"You've already uploaded " + str(count) + " of 3." if count > 0 else "No photos uploaded yet this week."}
              </p>

              <!-- Progress dots -->
              <div style="display:flex;gap:8px;margin-bottom:24px">
                {"".join([
                    f'<div style="width:36px;height:36px;border-radius:50%;background:#1D9E75;display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:14px">✓</span></div>'
                    if j < count else
                    f'<div style="width:36px;height:36px;border-radius:50%;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center"><span style="font-size:12px;color:#9ca3af">{j+1}</span></div>'
                    for j in range(3)
                ])}
              </div>

              <a href="{upload_url}"
                 style="display:block;text-align:center;background:#1D9E75;color:white;
                        padding:14px;border-radius:8px;text-decoration:none;
                        font-weight:600;font-size:15px">
                Upload photos now →
              </a>
              <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px">
                If you don't upload by 8pm tonight, this week's posts won't be generated.
              </p>
            </div>"""

            resend_client.Emails.send({
                # "from":    "Socio <hello@socio.app>",
                # "to":      [email],
                "from":    "onboarding@resend.dev",
                "to":      "snehapatani@gmail.com",
                "subject": f"📷 Upload {needed} photo{'s' if needed > 1 else ''} — Socio generates posts tonight",
                "html":    html,
            })
            log.info(f"Reminder sent to {email} ({needed} photos needed)")

        except Exception as e:
            log.error(f"Reminder failed for {bid}: {e}")
