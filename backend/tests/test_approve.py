import os
import sys
from unittest.mock import MagicMock

# ── Block external SDKs before any project module is imported ─────────────────
# supabase validates its API key at create_client() time; resend would also call
# out. Replace both with mocks in sys.modules so db.client and approve.py never
# touch the real libraries.
for _mod in ["supabase", "resend", "gotrue", "supabase_auth"]:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# Minimal env vars required by pydantic Settings() at import time
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("FB_APP_ID", "test-fb-id")
os.environ.setdefault("FB_APP_SECRET", "test-fb-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("GOOGLE_API_KEY", "test-google-key")
os.environ.setdefault("RESEND_API_KEY", "test-resend-key")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "dGVzdC10b2tlbi1lbmNyeXB0aW9uLWtleTMyYnl0")
os.environ.setdefault("TZ", "UTC")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")

import pytest
from unittest.mock import patch
from fastapi import HTTPException

from routers.approve import send_approval_email, ApprovalRequest


# ── Fixtures ──────────────────────────────────────────────────────────────────

BUSINESS_ID = "biz-abc123"
POST_IDS = ["post-1", "post-2"]
FAKE_TOKEN = "fake-secure-token-abc123"
FRONTEND_URL = "http://localhost:5173"

FAKE_POSTS = [
    {
        "id": "post-1",
        "caption": "Amazing product showcase that everyone will love " * 4,
        "media_urls": ["https://cdn.example.com/image1.jpg"],
        "media_url": None,
        "media_type": "IMAGE",
        "scheduled_at": "2026-05-23T10:00:00",
    },
    {
        "id": "post-2",
        "caption": "Watch our behind the scenes video content now " * 4,
        "media_urls": ["https://cdn.example.com/video1.mp4"],
        "media_url": None,
        "media_type": "VIDEO",
        "scheduled_at": "2026-05-24T14:30:00",
    },
]

FAKE_CAROUSEL_POST = {
    "id": "post-3",
    "caption": "Swipe through our new collection and find your style " * 3,
    "media_urls": [
        "https://cdn.example.com/slide1.jpg",
        "https://cdn.example.com/slide2.jpg",
        "https://cdn.example.com/slide3.jpg",
    ],
    "media_url": None,
    "media_type": "CAROUSEL",
    "scheduled_at": "2026-05-25T09:00:00",
}

FAKE_BUSINESS = {
    "name": "Acme Corp",
    "owner_email": "owner@acmecorp.com",
}


_UNSET = object()

def _make_supabase_mock(posts_data=_UNSET, business_data=_UNSET):
    """Build a supabase MagicMock with per-table side_effects."""
    if posts_data is _UNSET:
        posts_data = FAKE_POSTS
    if business_data is _UNSET:
        business_data = FAKE_BUSINESS

    posts_mock = MagicMock()
    posts_mock.select.return_value.in_.return_value.execute.return_value.data = posts_data

    biz_mock = MagicMock()
    biz_mock.select.return_value.eq.return_value.single.return_value.execute.return_value.data = business_data

    tokens_mock = MagicMock()

    def _table(name):
        return {"posts": posts_mock, "businesses": biz_mock, "approval_tokens": tokens_mock}.get(
            name, MagicMock()
        )

    sb = MagicMock()
    sb.table.side_effect = _table
    return sb, tokens_mock


@pytest.fixture
def body():
    return ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)


@pytest.fixture
def mock_settings():
    s = MagicMock()
    s.FRONTEND_URL = FRONTEND_URL
    return s


# ── Happy path ────────────────────────────────────────────────────────────────

def test_returns_sent_true_and_token(body, mock_settings):
    sb, _ = _make_supabase_mock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", MagicMock()), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        result = send_approval_email(body)

    assert result["sent"] is True
    assert result["token"] == FAKE_TOKEN
    assert result["to"] == FAKE_BUSINESS["owner_email"]


def test_token_inserted_into_supabase(body, mock_settings):
    sb, tokens_mock = _make_supabase_mock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", MagicMock()), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    insert_call = tokens_mock.insert.call_args[0][0]
    assert insert_call["token"] == FAKE_TOKEN
    assert insert_call["business_id"] == BUSINESS_ID
    assert insert_call["post_ids"] == POST_IDS
    assert "expires_at" in insert_call


def test_email_sent_once(body, mock_settings):
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    mock_resend.Emails.send.assert_called_once()


def test_email_subject_contains_post_count_and_business(body, mock_settings):
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    subject = mock_resend.Emails.send.call_args[0][0]["subject"]
    assert "2" in subject
    assert FAKE_BUSINESS["name"] in subject


def test_html_contains_approve_url(body, mock_settings):
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert f"{FRONTEND_URL}/approve/{FAKE_TOKEN}" in html


def test_html_contains_business_name(body, mock_settings):
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert "Acme Corp" in html


def test_html_contains_post_captions(body, mock_settings):
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert FAKE_POSTS[0]["caption"][:50] in html
    assert FAKE_POSTS[1]["caption"][:50] in html


def test_html_renders_video_play_button(body, mock_settings):
    """VIDEO posts should get the play button overlay in the email HTML."""
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    # play--v1.png icon is only injected for VIDEO posts
    assert "play--v1.png" in html


def test_html_uses_socio_violet_brand_color(body, mock_settings):
    """Email HTML should use Socio's primary violet, not the old green."""
    sb, _ = _make_supabase_mock()
    mock_resend = MagicMock()
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert "#6C47FF" in html
    assert "#1D9E75" not in html  # old green must be gone


# ── Error cases ───────────────────────────────────────────────────────────────

def test_raises_404_when_no_posts_found(mock_settings):
    sb, _ = _make_supabase_mock(posts_data=[])
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", MagicMock()), \
         patch("routers.approve.settings", mock_settings):

        with pytest.raises(HTTPException) as exc:
            send_approval_email(body)

    assert exc.value.status_code == 404
    assert "posts" in exc.value.detail.lower()


def test_raises_404_when_business_not_found(mock_settings):
    sb, _ = _make_supabase_mock(business_data=None)
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", MagicMock()), \
         patch("routers.approve.settings", mock_settings):

        with pytest.raises(HTTPException) as exc:
            send_approval_email(body)

    assert exc.value.status_code == 404
    assert "business" in exc.value.detail.lower()


def test_no_email_sent_when_posts_missing(mock_settings):
    sb, _ = _make_supabase_mock(posts_data=[])
    mock_resend = MagicMock()
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings):

        with pytest.raises(HTTPException):
            send_approval_email(body)

    mock_resend.Emails.send.assert_not_called()


# ── Media rendering ───────────────────────────────────────────────────────────

def test_image_url_appears_in_html(mock_settings):
    single_post = [FAKE_POSTS[0]]
    sb, _ = _make_supabase_mock(posts_data=single_post)
    mock_resend = MagicMock()
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=["post-1"])
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        result = send_approval_email(body)

    assert result["sent"] is True
    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert "play--v1.png" not in html
    assert single_post[0]["media_urls"][0] in html


def test_video_shows_play_button_not_img_tag(mock_settings):
    """Video posts must not embed a raw .mp4 as <img> — email clients can't render it."""
    single_video = [FAKE_POSTS[1]]
    sb, _ = _make_supabase_mock(posts_data=single_video)
    mock_resend = MagicMock()
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=["post-2"])
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert "play--v1.png" in html
    # The raw .mp4 must NOT be used as an <img> src
    assert 'src="https://cdn.example.com/video1.mp4"' not in html


def test_carousel_shows_all_slide_thumbnails(mock_settings):
    """CAROUSEL posts should render each slide as a thumbnail in the email."""
    sb, _ = _make_supabase_mock(posts_data=[FAKE_CAROUSEL_POST])
    mock_resend = MagicMock()
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=["post-3"])
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    for url in FAKE_CAROUSEL_POST["media_urls"]:
        assert url in html
    assert "CAROUSEL" in html


def test_fallback_to_legacy_media_url(mock_settings):
    """Posts with only media_url (no media_urls array) should still render."""
    legacy_post = {
        "id": "post-leg",
        "caption": "Legacy post with single media_url field " * 4,
        "media_urls": None,
        "media_url": "https://cdn.example.com/legacy.jpg",
        "media_type": "IMAGE",
        "scheduled_at": "2026-05-26T08:00:00",
    }
    sb, _ = _make_supabase_mock(posts_data=[legacy_post])
    mock_resend = MagicMock()
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=["post-leg"])
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.resend", mock_resend), \
         patch("routers.approve.settings", mock_settings), \
         patch("routers.approve.secrets.token_urlsafe", return_value=FAKE_TOKEN):

        send_approval_email(body)

    html = mock_resend.Emails.send.call_args[0][0]["html"]
    assert "https://cdn.example.com/legacy.jpg" in html
