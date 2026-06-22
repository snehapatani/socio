from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from database import supabase
from routers.posts import generate_posts, publish_post
from datetime import datetime, timedelta, timezone
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
    from core.auth import refresh_token   # imported here to avoid circular
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


def job_photo_reminder():
    """Every Monday 13:07 UTC — remind owners to upload photos if they have fewer than 3 unused."""
    from services.email_builder import photo_reminder_email, FROM_EMAIL

    resend_client.api_key = settings.RESEND_API_KEY

    pages = supabase.table("instagram_pages").select(
        "business_id"
    ).eq("is_active", True).execute()

    for page in (pages.data or []):
        bid = page["business_id"]
        try:
            pending = supabase.table("media_library").select("id").eq(
                "business_id", bid
            ).eq("times_used", 0).execute()

            count = len(pending.data or [])
            if count >= 3:
                log.info(f"Business {bid} has {count} unused photos — skipping reminder")
                continue

            needed = 3 - count

            rows = supabase.table("businesses").select(
                "name, owner_email"
            ).eq("id", bid).limit(1).execute()
            if not rows.data:
                continue

            name  = rows.data[0]["name"]
            email = rows.data[0]["owner_email"]

            subject, html = photo_reminder_email(
                name=name,
                count=count,
                needed=needed,
                upload_url=settings.FRONTEND_URL,
            )

            resend_client.Emails.send({
                "from":    FROM_EMAIL,
                "to":      "snehapatani@gmail.com",
                "subject": subject,
                "html":    html,
            })
            log.info(f"Reminder sent to {email} ({needed} photo{'s' if needed > 1 else ''} needed)")

        except Exception as e:
            log.error(f"Reminder failed for {bid}: {e}")


def job_send_approval_emails():
    """Every 5 minutes — send queued approval emails."""
    from services.email_builder import approval_email, FROM_EMAIL

    resend_client.api_key = settings.RESEND_API_KEY

    # Find unsent approval tokens
    all_tokens = supabase.table("approval_tokens").select("*").execute()
    tokens = [t for t in (all_tokens.data or []) if not t.get("email_sent_at")]

    for token_row in tokens:
        try:
            token = token_row["token"]
            business_id = token_row["business_id"]
            post_ids = token_row["post_ids"]

            # Fetch posts
            posts = supabase.table("posts").select("*").in_("id", post_ids).execute()
            if not posts.data:
                continue

            # Fetch business
            biz = supabase.table("businesses").select(
                "name, owner_email"
            ).eq("id", business_id).single().execute()
            if not biz.data:
                continue

            approve_url = f"{settings.FRONTEND_URL}/approve/{token}"

            subject, html = approval_email(
                posts=posts.data,
                biz_name=biz.data["name"],
                approve_url=approve_url,
                frontend_url=settings.FRONTEND_URL,
            )

            resend_client.Emails.send({
                "from": FROM_EMAIL,
                "to": biz.data["owner_email"],
                "subject": subject,
                "html": html,
            })

            # Mark as sent
            supabase.table("approval_tokens").update({
                "email_sent_at": datetime.now(timezone.utc).isoformat()
            }).eq("token", token).execute()

            log.info(f"Approval email sent for token {token[:8]}... to {biz.data['owner_email']}")

        except Exception as e:
            log.error(f"Approval email failed for token {token_row['token'][:8]}...: {e}")


def job_fetch_all_insights():
    """Daily 02:00 UTC — fetch IG insights for all published posts.

    Posts published within the last 7 days: fetched every run (daily).
    Posts published more than 7 days ago: fetched only on Sundays (weekly).
    """
    from services.post_insights import fetch_and_store_insights

    now          = datetime.now(timezone.utc)
    is_sunday    = now.weekday() == 6
    cutoff       = (now - timedelta(days=7)).isoformat()

    recent = supabase.table("posts").select("id").eq("status", "published").gte(
        "scheduled_at", cutoff
    ).execute()

    recent_count = 0
    for post in (recent.data or []):
        try:
            fetch_and_store_insights(post["id"])
            recent_count += 1
        except Exception as e:
            log.error(f"Insights fetch failed for post {post['id']}: {e}")

    log.info(f"Insights job — {recent_count} recent posts refreshed")

    if not is_sunday:
        return

    older = supabase.table("posts").select("id").eq("status", "published").lt(
        "scheduled_at", cutoff
    ).execute()

    older_count = 0
    for post in (older.data or []):
        try:
            fetch_and_store_insights(post["id"])
            older_count += 1
        except Exception as e:
            log.error(f"Insights fetch failed for older post {post['id']}: {e}")

    log.info(f"Insights job (weekly sweep) — {older_count} older posts refreshed")


def start_scheduler():
    scheduler = BackgroundScheduler(timezone=settings.TZ)

    # Generate posts every Sunday at 20:00 UTC
    scheduler.add_job(job_generate_all, CronTrigger(day_of_week="sun", hour=20, minute=0))

    # Publish due posts every minute
    scheduler.add_job(job_publish_due, CronTrigger(minute="*"))

    # Refresh expiring tokens every day at 03:00 UTC
    scheduler.add_job(job_refresh_tokens, CronTrigger(hour=3, minute=0))

    # Photo reminder: Monday 13:07 UTC (10 hours before generation)
    scheduler.add_job(job_photo_reminder, CronTrigger(day_of_week="mon", hour=13, minute=7))

    # Send approval emails every 5 minutes
    scheduler.add_job(job_send_approval_emails, CronTrigger(minute="*/5"))

    # Fetch post insights daily at 02:00 UTC (older posts only on Sundays)
    scheduler.add_job(job_fetch_all_insights, CronTrigger(hour=2, minute=0))

    scheduler.start()
    log.info("Scheduler started — 6 jobs running")
    return scheduler
