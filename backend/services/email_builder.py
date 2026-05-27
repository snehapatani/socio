"""Shared HTML email templates for Socio transactional emails.

All emails share the same brand shell (logo, Sora font, violet palette).
Each builder returns (subject, html) ready to pass to Resend.
"""

from config import settings

FROM_EMAIL = "onboarding@resend.dev"

_LOGO_URL   = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/assets/socio-logo.png"
_VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".webm")


# ── Shared primitives ──────────────────────────────────────────────────────────

def _logo_block() -> str:
    return f"""  <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="vertical-align:middle;padding-right:10px;">
        <img src="{_LOGO_URL}" width="36" height="35" alt="Socio" style="display:block;" />
      </td>
      <td style="vertical-align:middle;">
        <span style="font-size:20px;font-weight:700;color:#2E1065;letter-spacing:-0.3px;">Socio</span>
      </td>
    </tr>
  </table>"""


def _cta_button(url: str, label: str) -> str:
    return f"""  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <a href="{url}"
           style="display:inline-block;width:100%;box-sizing:border-box;text-align:center;
                  background:#6C47FF;color:#ffffff;padding:15px 24px;border-radius:16px;
                  text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.2px;
                  box-shadow:0 8px 24px -8px rgba(108,71,255,0.55);
                  font-family:'Sora',Inter,sans-serif;">
          {label}
        </a>
      </td>
    </tr>
  </table>"""


def _shell(content: str, max_width: int = 520) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#FAFAFF;">
<div style="font-family:'Sora',Inter,system-ui,sans-serif;max-width:{max_width}px;margin:0 auto;padding:40px 24px;">

{_logo_block()}
{content}
</div>
</body>
</html>"""


# ── Photo upload reminder ──────────────────────────────────────────────────────

def photo_reminder_email(
    *,
    name: str,
    count: int,
    needed: int,
    upload_url: str,
) -> tuple[str, str]:
    """Return (subject, html) for the weekly photo upload reminder."""
    photo_word    = f"photo{'s' if needed > 1 else ''}"
    progress_note = (
        f"You've already uploaded {count} of 3." if count > 0
        else "No photos uploaded yet this week."
    )

    dots = ""
    for j in range(3):
        if j < count:
            dots += (
                '<td style="padding:0 4px;">'
                '<table border="0" cellpadding="0" cellspacing="0">'
                '<tr><td align="center" width="40" height="40" bgcolor="#6C47FF" '
                'style="border-radius:50%;color:white;font-size:16px;'
                'font-family:\'Sora\',Inter,sans-serif;font-weight:700;">&#10003;</td></tr>'
                '</table></td>'
            )
        else:
            dots += (
                '<td style="padding:0 4px;">'
                '<table border="0" cellpadding="0" cellspacing="0">'
                f'<tr><td align="center" width="40" height="40" bgcolor="#F1EFFF" '
                f'style="border-radius:50%;border:2px dashed #C4B5FD;color:#A78BFA;'
                f'font-size:13px;font-family:\'Sora\',Inter,sans-serif;font-weight:700;">'
                f'{j + 1}</td></tr>'
                '</table></td>'
            )

    content = f"""  <h2 style="font-size:22px;font-weight:700;color:#2E1065;margin:0 0 10px;letter-spacing:-0.3px;">
    Upload {needed} {photo_word} for next week
  </h2>
  <p style="font-size:14px;color:#7C3AED;margin:0 0 6px;line-height:1.6;">
    Socio generates next week's posts for
    <strong style="color:#2E1065;">{name}</strong>
    tonight at 8&nbsp;pm &mdash; but we need {needed} more {photo_word} first.
  </p>
  <p style="font-size:13px;color:#A78BFA;margin:0 0 28px;font-weight:600;">
    {progress_note}
  </p>

  <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>{dots}</tr>
  </table>

{_cta_button(upload_url, f"Upload {photo_word} now &rarr;")}

  <p style="font-size:12px;color:#A78BFA;text-align:center;margin-top:20px;line-height:1.5;">
    If you don't upload by 8&nbsp;pm tonight, this week's posts won't be generated.
  </p>"""

    subject = f"✦ Upload {needed} {photo_word} — {name}'s posts generate tonight"
    return subject, _shell(content)


# ── Post approval digest ───────────────────────────────────────────────────────

def _is_video_url(url: str) -> bool:
    return url.lower().split("?")[0].endswith(_VIDEO_EXTS)


def _post_preview(p: dict) -> str:
    media_type = p.get("media_type", "IMAGE")
    urls = p.get("media_urls") or []
    if not urls and p.get("media_url"):
        urls = [p["media_url"]]

    if media_type == "CAROUSEL" or len(urls) > 1:
        thumb_cells = ""
        for url in urls[:4]:
            thumb_cells += f"""
                <td width="25%" style="padding:2px;">
                    <img src="{url}" width="100%" style="display:block;border-radius:8px;height:80px;object-fit:cover;" />
                </td>"""
        extra      = f"+{len(urls) - 4}" if len(urls) > 4 else ""
        extra_html = (
            f"<p style='font-size:11px;color:#A78BFA;margin:6px 0 0;text-align:right;font-family:sans-serif;'>"
            f"{extra} more slides</p>"
            if extra else ""
        )
        media_html = f"""
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;">
                <tr>{thumb_cells}</tr>
            </table>
            {extra_html}
            <div style="display:inline-block;margin-top:8px;background:#EDE9FE;color:#6C47FF;font-size:10px;
                        font-weight:700;letter-spacing:0.5px;padding:3px 8px;border-radius:20px;font-family:sans-serif;">
                CAROUSEL &nbsp;·&nbsp; {len(urls)} slides
            </div>"""
        preview_href = urls[0] if urls else "#"

    elif media_type == "VIDEO" or (urls and _is_video_url(urls[0])):
        media_html = """
            <div style="width:100%;height:200px;background:linear-gradient(135deg,#1a0f3c,#2E1065);
                        border-radius:12px;text-align:center;padding-top:68px;box-sizing:border-box;">
                <table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                        <td align="center" bgcolor="#6C47FF"
                            style="border-radius:50%;padding:16px;width:52px;height:52px;">
                            <img src="https://img.icons8.com/ios-glyphs/30/ffffff/play--v1.png"
                                 width="24" height="24" style="display:block;" />
                        </td>
                    </tr>
                </table>
                <p style="color:#C4B5FD;font-size:11px;margin:10px 0 0;font-family:sans-serif;letter-spacing:0.5px;">
                    VIDEO
                </p>
            </div>"""
        preview_href = urls[0] if urls else "#"

    else:
        src          = urls[0] if urls else "https://via.placeholder.com/400x400?text=No+Image"
        media_html   = f'<img src="{src}" style="width:100%;height:200px;object-fit:cover;display:block;border-radius:12px;" />'
        preview_href = src

    scheduled = p.get("scheduled_at", "")[:16].replace("T", " ")
    return f"""
        <div style="border:1px solid #EDE9FE;border-radius:16px;padding:16px;margin-bottom:16px;
                    background-color:#ffffff;box-shadow:0 4px 20px -8px rgba(108,71,255,0.10);">
            <div style="width:100%;overflow:hidden;border-radius:12px;margin-bottom:14px;background:#F1EFFF;">
                <a href="{preview_href}" target="_blank" style="text-decoration:none;display:block;">
                    {media_html}
                </a>
            </div>
            <p style="font-size:14px;line-height:1.6;color:#2E1065;margin:0 0 10px;font-family:'Sora',Inter,sans-serif;">
                {p['caption'][:200]}...
            </p>
            <p style="font-size:11px;color:#A78BFA;margin:0;text-transform:uppercase;
                      letter-spacing:0.6px;font-family:'Sora',Inter,sans-serif;font-weight:600;">
                {scheduled} UTC &nbsp;&middot;&nbsp; {media_type.upper()}
            </p>
        </div>"""


def approval_email(
    *,
    posts: list[dict],
    biz_name: str,
    approve_url: str,
    frontend_url: str,
) -> tuple[str, str]:
    """Return (subject, html) for the weekly post approval digest."""
    post_count    = len(posts)
    post_previews = "".join(_post_preview(p) for p in posts)

    content = f"""  <h2 style="font-size:22px;font-weight:700;color:#2E1065;margin:0 0 8px;
            font-family:'Sora',Inter,sans-serif;letter-spacing:-0.3px;">
    Your posts for this week are ready
  </h2>
  <p style="font-size:14px;color:#7C3AED;margin:0 0 28px;font-family:'Sora',Inter,sans-serif;line-height:1.5;">
    {post_count} posts generated for <strong style="color:#2E1065;">{biz_name}</strong>.
    Takes 30 seconds to approve.
  </p>

  {post_previews}

{_cta_button(approve_url, f"Approve all {post_count} posts &rarr;")}

  <p style="font-size:12px;color:#A78BFA;text-align:center;margin-top:20px;font-family:'Sora',Inter,sans-serif;">
    Or <a href="{frontend_url}" style="color:#6C47FF;text-decoration:underline;">review individually</a>.
    &nbsp;&middot;&nbsp; Link expires in 7 days.
  </p>"""

    subject = f"✦ {biz_name}: {post_count} posts ready to go live — approve in one click"
    return subject, _shell(content, max_width=580)
