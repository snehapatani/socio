"""Tests for services/email_builder.py — shared email templates."""
import sys
from unittest.mock import MagicMock

# ── Block config before import ────────────────────────────────────────────────
_mock_settings = MagicMock()
_mock_settings.SUPABASE_URL = "https://test.supabase.co"
sys.modules["config"] = MagicMock(settings=_mock_settings)

import pytest
from services.email_builder import (
    FROM_EMAIL,
    photo_reminder_email,
    approval_email,
    _logo_block,
    _cta_button,
    _shell,
)


class TestConstants:
    def test_from_email_is_valid(self):
        assert isinstance(FROM_EMAIL, str) and "@" in FROM_EMAIL


class TestLogoBlock:
    def test_contains_supabase_logo_url(self):
        html = _logo_block()
        assert "test.supabase.co" in html
        assert "socio-logo.png" in html

    def test_contains_socio_wordmark(self):
        assert "Socio" in _logo_block()


class TestCtaButton:
    def test_contains_url(self):
        assert "https://example.com/cta" in _cta_button("https://example.com/cta", "Go")

    def test_contains_label(self):
        assert "Upload now" in _cta_button("https://example.com", "Upload now")

    def test_uses_violet_bg(self):
        assert "#6C47FF" in _cta_button("https://x.com", "Click")


class TestShell:
    def test_has_doctype(self):
        assert "<!DOCTYPE html>" in _shell("<p>x</p>")

    def test_default_max_width_520(self):
        assert "max-width:520px" in _shell("<p>x</p>")

    def test_custom_max_width(self):
        assert "max-width:580px" in _shell("<p>x</p>", max_width=580)

    def test_includes_content(self):
        assert "unique-sentinel-content" in _shell("<p>unique-sentinel-content</p>")

    def test_brand_background(self):
        assert "#FAFAFF" in _shell("<p>x</p>")


class TestPhotoReminderEmail:
    def _build(self, **kw):
        defaults = dict(name="Acme", count=0, needed=3, upload_url="https://app.socio.com")
        return photo_reminder_email(**{**defaults, **kw})

    def test_returns_two_strings(self):
        subject, html = self._build()
        assert isinstance(subject, str) and isinstance(html, str)

    def test_subject_contains_needed_count(self):
        subject, _ = self._build(needed=2)
        assert "2" in subject

    def test_subject_contains_name(self):
        subject, _ = self._build(name="Bella Café")
        assert "Bella Café" in subject

    def test_subject_singular_photo(self):
        subject, _ = self._build(needed=1)
        assert "photo" in subject and "photos" not in subject

    def test_subject_plural_photos(self):
        subject, _ = self._build(needed=3)
        assert "photos" in subject

    def test_html_contains_business_name(self):
        _, html = self._build(name="Green Leaf")
        assert "Green Leaf" in html

    def test_html_no_uploads_note(self):
        _, html = self._build(count=0)
        assert "No photos uploaded yet" in html

    def test_html_partial_uploads_note(self):
        _, html = self._build(count=1)
        assert "already uploaded" in html and "1 of 3" in html

    def test_html_contains_upload_url(self):
        _, html = self._build(upload_url="https://app.test.com")
        assert "https://app.test.com" in html

    def test_html_filled_dot_color_when_uploaded(self):
        _, html = self._build(count=2)
        assert "#6C47FF" in html   # filled slot bg
        assert "#F1EFFF" in html   # empty slot bg

    def test_html_has_doctype(self):
        _, html = self._build()
        assert "<!DOCTYPE html>" in html

    def test_cta_label_plural(self):
        _, html = self._build(needed=2)
        assert "photos" in html.lower()

    def test_cta_label_singular(self):
        _, html = self._build(needed=1)
        # CTA contains "photo" not "photos"
        assert "Upload photo" in html or "photo now" in html


class TestApprovalEmail:
    _POST = {
        "caption": "A great post caption",
        "media_type": "IMAGE",
        "media_urls": ["https://cdn.example.com/photo.jpg"],
        "scheduled_at": "2026-05-26T18:00:00",
    }

    def _build(self, **kw):
        defaults = dict(
            posts=[self._POST],
            biz_name="Test Biz",
            approve_url="https://app.socio.com/approve/tok123",
            frontend_url="https://app.socio.com",
        )
        return approval_email(**{**defaults, **kw})

    def test_returns_two_strings(self):
        subject, html = self._build()
        assert isinstance(subject, str) and isinstance(html, str)

    def test_subject_contains_biz_name(self):
        subject, _ = self._build(biz_name="Cool Store")
        assert "Cool Store" in subject

    def test_subject_contains_post_count(self):
        subject, _ = self._build(posts=[self._POST, self._POST])
        assert "2" in subject

    def test_html_contains_approve_url(self):
        _, html = self._build(approve_url="https://app.socio.com/approve/MYTOKEN")
        assert "MYTOKEN" in html

    def test_html_contains_biz_name(self):
        _, html = self._build(biz_name="Fancy Café")
        assert "Fancy Café" in html

    def test_html_contains_caption(self):
        _, html = self._build(posts=[{**self._POST, "caption": "Unique caption alpha"}])
        assert "Unique caption alpha" in html

    def test_html_uses_wide_max_width(self):
        _, html = self._build()
        assert "max-width:580px" in html

    def test_html_contains_frontend_url(self):
        _, html = self._build(frontend_url="https://review.socio.com")
        assert "https://review.socio.com" in html

    def test_image_post_uses_img_tag(self):
        post = {**self._POST, "media_type": "IMAGE", "media_urls": ["https://cdn.example.com/pic.jpg"]}
        _, html = self._build(posts=[post])
        assert 'src="https://cdn.example.com/pic.jpg"' in html

    def test_video_post_shows_play_icon_not_raw_video_src(self):
        post = {**self._POST, "media_type": "VIDEO", "media_urls": ["https://cdn.example.com/clip.mp4"]}
        _, html = self._build(posts=[post])
        assert "VIDEO" in html
        assert "play--v1.png" in html
        assert '<img src="https://cdn.example.com/clip.mp4"' not in html

    def test_carousel_shows_thumbnails_and_slide_count(self):
        post = {**self._POST, "media_type": "CAROUSEL",
                "media_urls": ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]}
        _, html = self._build(posts=[post])
        assert "CAROUSEL" in html
        assert "2 slides" in html
        assert "https://cdn.example.com/a.jpg" in html

    def test_carousel_extra_slides_label(self):
        urls = [f"https://cdn.example.com/{i}.jpg" for i in range(6)]
        post = {**self._POST, "media_type": "CAROUSEL", "media_urls": urls}
        _, html = self._build(posts=[post])
        assert "+2" in html

    def test_legacy_media_url_fallback(self):
        post = {"caption": "Old post", "media_type": "IMAGE",
                "media_url": "https://cdn.example.com/old.jpg", "scheduled_at": "2026-01-01T10:00:00"}
        _, html = self._build(posts=[post])
        assert "https://cdn.example.com/old.jpg" in html

    def test_multiple_posts_all_appear(self):
        posts = [{**self._POST, "caption": "Caption alpha"},
                 {**self._POST, "caption": "Caption beta"}]
        _, html = self._build(posts=posts)
        assert "Caption alpha" in html and "Caption beta" in html

    def test_caption_truncated_at_200_chars(self):
        long = "A" * 300
        _, html = self._build(posts=[{**self._POST, "caption": long}])
        assert "A" * 300 not in html
        assert "A" * 200 in html

    def test_video_url_detected_by_extension(self):
        post = {**self._POST, "media_type": "IMAGE",
                "media_urls": ["https://cdn.example.com/reel.mp4"]}
        _, html = self._build(posts=[post])
        assert "VIDEO" in html  # extension wins over media_type
