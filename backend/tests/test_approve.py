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


# ── Error cases ───────────────────────────────────────────────────────────────

def test_raises_404_when_no_posts_found(mock_settings):
    sb, _ = _make_supabase_mock(posts_data=[])
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)
    with patch("routers.approve.supabase", sb), \
         patch("routers.approve.settings", mock_settings):

        with pytest.raises(HTTPException) as exc:
            send_approval_email(body)

    assert exc.value.status_code == 404
    assert "posts" in exc.value.detail.lower()


def test_raises_404_when_business_not_found(mock_settings):
    sb, _ = _make_supabase_mock(business_data=None)
    body = ApprovalRequest(business_id=BUSINESS_ID, post_ids=POST_IDS)
    with patch("routers.approve.supabase", sb), \
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


# ── Notes ──────────────────────────────────────────────────────────────────

# Email content/rendering tests are in test_email_builder.py::TestApprovalEmail
# The endpoint sends emails immediately for manual approval requests.
# The scheduler job job_generate_all also sends approval emails when posts are generated (weekly).
