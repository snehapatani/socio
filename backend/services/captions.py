"""AI caption generation via Anthropic Claude.

In development, set MOCK_AI=true in .env to return canned captions
instead of calling Claude. Useful for UI work without burning API spend.
"""

import json
import logging

import anthropic

from config import settings
from services._mocks import mock_post_captions, mock_carousel_caption

log = logging.getLogger(__name__)
_claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

CLAUDE_MODEL = "claude-sonnet-4-20250514"


# ── Per-photo captions ──────────────────────────────────────────────
def generate_post_captions(business: dict, media: list) -> list[dict]:
    """Generate one caption per media item.
    Returns: [{caption: str, hashtags: list[str]}, ...]
    """
    if settings.MOCK_AI:
        log.info("MOCK_AI=true → returning mock captions (%d)", len(media))
        return mock_post_captions(len(media))

    instruction = """You will be given photos. Write one Instagram post for each photo, in order.
Respond ONLY with a JSON array of objects matching the count of photos. No markdown, no preamble.
Format:
[
  {
    "caption": "Full caption text — engaging, on-brand, ends with a soft CTA",
    "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }
]"""

    content: list = [
        {"type": "text", "text": "Write one Instagram caption for each of these photos, in order."},
    ]
    for i, photo in enumerate(media):
        content.append({"type": "text", "text": f"Photo {i + 1}:"})
        content.append({
            "type": "image",
            "source": {"type": "url", "url": photo["media_url"]},
        })

    message = _claude.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1200,
        system=_system_prompt(business, instruction),
        messages=[{"role": "user", "content": content}],
    )
    return _parse_json_response(message.content[0].text)


# ── Carousel: one cohesive caption ──────────────────────────────────
def generate_carousel_caption(business: dict, media: list) -> dict:
    """Generate a single caption that ties a multi-photo carousel together.
    Returns: {caption: str, hashtags: list[str]}
    """
    if settings.MOCK_AI:
        log.info("MOCK_AI=true → returning mock carousel caption")
        return mock_carousel_caption()

    instruction = """You will be given a SET of photos that will be published together as an Instagram CAROUSEL.
Write ONE caption that ties all the photos into a single cohesive story, theme, or showcase.
Don't describe each photo separately — write as if the reader will swipe through them as a unit.

Respond ONLY with a JSON object. No markdown, no preamble.
Format:
{
  "caption": "Full caption text — opens strong, frames the carousel as a journey/set/series, ends with a soft CTA",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}"""

    content: list = [
        {"type": "text", "text": f"Here are {len(media)} photos to be published as a single carousel:"},
    ]
    for i, photo in enumerate(media):
        content.append({"type": "text", "text": f"Slide {i + 1}:"})
        content.append({
            "type": "image",
            "source": {"type": "url", "url": photo["media_url"]},
        })

    message = _claude.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=800,
        system=_system_prompt(business, instruction),
        messages=[{"role": "user", "content": content}],
    )
    return _parse_json_response(message.content[0].text)


# ── Helpers ─────────────────────────────────────────────────────────
def _business_context_text(business: dict) -> str:
    ctx = business.get("business_context") or {}
    if not ctx:
        return "No additional context."
    return "\n".join(f"- {k}: {v}" for k, v in ctx.items())


def _system_prompt(business: dict, instruction: str) -> str:
    return f"""You are a social media manager for a {business.get('business_type', 'business')}.

Business name: {business['name']}
Brand tone: {business.get('brand_tone', 'warm and friendly')}
Additional context:
{_business_context_text(business)}

{instruction}"""


def _parse_json_response(raw: str):
    """Strip optional ```json fencing and parse."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
