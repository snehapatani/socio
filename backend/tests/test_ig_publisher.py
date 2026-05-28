"""Tests for services/ig_publisher.py"""
import sys
import json
from unittest.mock import MagicMock, patch

# ── Block external deps before import ─────────────────────────────────────────
_mock_supabase = MagicMock()
_mock_requests = MagicMock()
_mock_security = MagicMock()
_mock_security.decrypt_token.return_value = "decrypted-token"

_mock_resend         = MagicMock()
_mock_email_builder  = MagicMock()
_mock_email_builder.post_published_email.return_value = ("Published subject", "<html/>")
_mock_email_builder.FROM_EMAIL = "test@resend.dev"

sys.modules["db"]                       = MagicMock()
sys.modules["db.client"]               = MagicMock(supabase=_mock_supabase)
sys.modules["core.security"]           = _mock_security
sys.modules["requests"]                = _mock_requests
sys.modules["resend"]                  = _mock_resend
sys.modules["services.email_builder"]  = _mock_email_builder

import pytest
from fastapi import HTTPException
from services.ig_publisher import (
    IGError,
    _compose_caption,
    _looks_like_video,
    create_media_container,
    create_carousel_container,
    wait_for_container_ready,
    publish_container,
    get_permalink,
    publish_post,
    GRAPH_API_BASE,
)

_IG   = "ig-user-123"
_TOK  = "access-token"
_PID  = "post-uuid-abc"


class TestComposeCaption:
    def test_caption_only(self):
        assert _compose_caption({"caption": "Hello", "hashtags": []}) == "Hello"

    def test_caption_with_hashtags(self):
        result = _compose_caption({"caption": "Hi", "hashtags": ["coffee", "morning"]})
        assert result == "Hi\n\n#coffee #morning"

    def test_none_hashtags(self):
        assert _compose_caption({"caption": "Hi", "hashtags": None}) == "Hi"

    def test_none_caption_becomes_empty_string(self):
        assert _compose_caption({"caption": None, "hashtags": []}) == ""

    def test_hashtags_prefixed_with_hash(self):
        result = _compose_caption({"caption": "x", "hashtags": ["a", "b"]})
        assert "#a" in result and "#b" in result


class TestLooksLikeVideo:
    @pytest.mark.parametrize("url", [
        "https://cdn.test/clip.mp4",
        "https://cdn.test/clip.MOV",
        "https://cdn.test/video.m4v",
        "https://cdn.test/clip.mp4?token=xyz",
    ])
    def test_video_urls(self, url):
        assert _looks_like_video(url) is True

    @pytest.mark.parametrize("url", [
        "https://cdn.test/photo.jpg",
        "https://cdn.test/image.png",
        "https://cdn.test/photo.jpeg",
        "https://cdn.test/graphic.gif",
    ])
    def test_image_urls(self, url):
        assert _looks_like_video(url) is False


class TestCreateMediaContainer:
    def setup_method(self):
        _mock_requests.reset_mock()

    def test_posts_to_media_endpoint(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-1"}
        create_media_container(_IG, _TOK, "https://img.jpg")
        url = _mock_requests.post.call_args.args[0]
        assert f"{GRAPH_API_BASE}/{_IG}/media" in url

    def test_image_sets_image_url(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-1"}
        create_media_container(_IG, _TOK, "https://img.jpg", media_type="IMAGE")
        params = _mock_requests.post.call_args.kwargs["params"]
        assert params["image_url"] == "https://img.jpg"
        assert "video_url" not in params

    def test_video_sets_video_url_and_reels_type(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-1"}
        create_media_container(_IG, _TOK, "https://vid.mp4", media_type="VIDEO")
        params = _mock_requests.post.call_args.kwargs["params"]
        assert params["video_url"] == "https://vid.mp4"
        assert params["media_type"] == "REELS"

    def test_caption_omitted_for_carousel_item(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-1"}
        create_media_container(_IG, _TOK, "https://img.jpg", caption="Cap", is_carousel_item=True)
        params = _mock_requests.post.call_args.kwargs["params"]
        assert "caption" not in params

    def test_caption_included_for_top_level_post(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-1"}
        create_media_container(_IG, _TOK, "https://img.jpg", caption="My caption", is_carousel_item=False)
        params = _mock_requests.post.call_args.kwargs["params"]
        assert params["caption"] == "My caption"

    def test_returns_container_id(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ctr-99"}
        assert create_media_container(_IG, _TOK, "https://img.jpg") == "ctr-99"

    def test_raises_ig_error_on_api_error(self):
        _mock_requests.post.return_value.json.return_value = {"error": {"message": "bad request"}}
        with pytest.raises(IGError) as exc:
            create_media_container(_IG, _TOK, "https://img.jpg")
        assert exc.value.code == "container_create_failed"


class TestCreateCarouselContainer:
    def setup_method(self):
        _mock_requests.reset_mock()

    def test_returns_container_id(self):
        _mock_requests.post.return_value.json.return_value = {"id": "carousel-ctr-1"}
        result = create_carousel_container(_IG, _TOK, ["c1", "c2"], "Caption")
        assert result == "carousel-ctr-1"

    def test_joins_child_ids_with_comma(self):
        _mock_requests.post.return_value.json.return_value = {"id": "x"}
        create_carousel_container(_IG, _TOK, ["c1", "c2", "c3"], "Cap")
        params = _mock_requests.post.call_args.kwargs["params"]
        assert params["children"] == "c1,c2,c3"

    def test_sets_media_type_carousel(self):
        _mock_requests.post.return_value.json.return_value = {"id": "x"}
        create_carousel_container(_IG, _TOK, ["c1"], "Cap")
        params = _mock_requests.post.call_args.kwargs["params"]
        assert params["media_type"] == "CAROUSEL"

    def test_raises_ig_error_on_failure(self):
        _mock_requests.post.return_value.json.return_value = {"error": {"message": "fail"}}
        with pytest.raises(IGError) as exc:
            create_carousel_container(_IG, _TOK, ["c1"], "Cap")
        assert exc.value.code == "carousel_create_failed"


class TestWaitForContainerReady:
    def setup_method(self):
        _mock_requests.reset_mock()

    def test_returns_immediately_on_finished(self):
        _mock_requests.get.return_value.json.return_value = {"status_code": "FINISHED"}
        wait_for_container_ready("ctr-1", _TOK)  # no exception

    def test_raises_on_error_status(self):
        _mock_requests.get.return_value.json.return_value = {
            "status_code": "ERROR", "status": "processing failed"
        }
        with pytest.raises(IGError) as exc:
            wait_for_container_ready("ctr-1", _TOK)
        assert exc.value.code == "processing_error"

    def test_raises_timeout_after_max_image_attempts(self):
        _mock_requests.get.return_value.json.return_value = {"status_code": "IN_PROGRESS"}
        with patch("services.ig_publisher.time.sleep"):
            with pytest.raises(IGError) as exc:
                wait_for_container_ready("ctr-1", _TOK, is_video=False)
        assert exc.value.code == "processing_timeout"

    def test_uses_more_attempts_for_video(self):
        # 14 in-progress then FINISHED at attempt 15
        _mock_requests.get.return_value.json.side_effect = (
            [{"status_code": "IN_PROGRESS"}] * 14 + [{"status_code": "FINISHED"}]
        )
        with patch("services.ig_publisher.time.sleep"):
            wait_for_container_ready("ctr-1", _TOK, is_video=True)
        assert _mock_requests.get.call_count == 15

    def test_sleeps_between_poll_attempts(self):
        _mock_requests.get.return_value.json.side_effect = [
            {"status_code": "IN_PROGRESS"},
            {"status_code": "FINISHED"},
        ]
        with patch("services.ig_publisher.time.sleep") as mock_sleep:
            wait_for_container_ready("ctr-1", _TOK)
        mock_sleep.assert_called_once()


class TestPublishContainer:
    def setup_method(self):
        _mock_requests.reset_mock()

    def test_returns_ig_media_id(self):
        _mock_requests.post.return_value.json.return_value = {"id": "ig-999"}
        assert publish_container(_IG, _TOK, "ctr-1") == "ig-999"

    def test_raises_ig_error_on_failure(self):
        _mock_requests.post.return_value.json.return_value = {"error": {"message": "publish failed"}}
        with pytest.raises(IGError) as exc:
            publish_container(_IG, _TOK, "ctr-1")
        assert exc.value.code == "publish_failed"


class TestGetPermalink:
    def setup_method(self):
        _mock_requests.reset_mock()
        # Explicitly clear side_effect — reset_mock() doesn't clear child side_effects
        _mock_requests.get.return_value.json.side_effect = None

    def test_returns_permalink(self):
        _mock_requests.get.return_value.json.return_value = {
            "permalink": "https://www.instagram.com/p/abc"
        }
        assert get_permalink("ig-1", _TOK) == "https://www.instagram.com/p/abc"

    def test_returns_empty_string_when_missing(self):
        _mock_requests.get.return_value.json.return_value = {}
        assert get_permalink("ig-1", _TOK) == ""


_DEFAULT_POST = {
    "id": _PID,
    "caption": "Test post",
    "hashtags": ["test"],
    "media_type": "IMAGE",
    "media_urls": ["https://cdn.test/photo.jpg"],
    "instagram_pages": {
        "ig_user_id": _IG,
        "ig_username": "test_ig_account",
        "access_token_encrypted": "enc-token",
    },
    "businesses": {
        "name": "Test Biz",
        "owner_email": "owner@test.com",
    },
}


class TestPublishPost:
    def setup_method(self):
        _mock_supabase.reset_mock()
        _mock_requests.reset_mock()
        _mock_resend.reset_mock()
        _mock_email_builder.reset_mock()
        # Restore post_published_email return value after reset
        _mock_email_builder.post_published_email.return_value = ("Published subject", "<html/>")
        _mock_email_builder.FROM_EMAIL = "test@resend.dev"
        # Explicitly clear side_effects — reset_mock() doesn't clear child side_effects
        _mock_requests.post.return_value.json.side_effect = None
        _mock_requests.get.return_value.json.side_effect  = None
        _mock_security.decrypt_token.return_value = "decrypted-token"

    def _stub_post(self, data):
        (
            _mock_supabase.table.return_value
            .select.return_value
            .eq.return_value
            .single.return_value
            .execute.return_value.data
        ) = data

    def _stub_ig_success(self):
        _mock_requests.post.return_value.json.side_effect = [
            {"id": "ctr-111"},        # create_media_container
            {"id": "ig-media-222"},   # publish_container
        ]
        _mock_requests.get.return_value.json.side_effect = [
            {"status_code": "FINISHED"},
            {"permalink": "https://www.instagram.com/p/xyz"},
        ]

    def test_raises_404_when_post_not_found(self):
        self._stub_post(None)
        with pytest.raises(HTTPException) as exc:
            publish_post(_PID)
        assert exc.value.status_code == 404

    def test_raises_400_when_no_media_urls(self):
        self._stub_post({**_DEFAULT_POST, "media_urls": []})
        with pytest.raises(HTTPException) as exc:
            publish_post(_PID)
        assert exc.value.status_code == 400

    def test_image_publish_returns_correct_shape(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            result = publish_post(_PID)
        assert result["published"] is True
        assert result["ig_media_id"] == "ig-media-222"
        assert result["permalink"] == "https://www.instagram.com/p/xyz"

    def test_db_updated_to_published_on_success(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            publish_post(_PID)
        update_calls = _mock_supabase.table.return_value.update.call_args_list
        update_data  = next(c.args[0] for c in update_calls if c.args[0].get("status") == "published")
        assert "ig_media_id" in update_data
        assert "ig_permalink" in update_data
        assert "published_at" in update_data

    def test_marks_failed_and_raises_502_on_ig_error(self):
        self._stub_post(_DEFAULT_POST)
        _mock_requests.post.return_value.json.return_value = {"error": {"message": "rate limited"}}
        with pytest.raises(HTTPException) as exc:
            publish_post(_PID)
        assert exc.value.status_code == 502

        update_calls = _mock_supabase.table.return_value.update.call_args_list
        failed = next((c for c in update_calls if c.args[0].get("status") == "failed"), None)
        assert failed is not None

    def test_carousel_flow_creates_carousel_container(self):
        self._stub_post({
            **_DEFAULT_POST,
            "caption": "Carousel cap", "hashtags": [],
            "media_type": "CAROUSEL",
            "media_urls": ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
        })
        _mock_requests.post.return_value.json.side_effect = [
            {"id": "child-1"},        # container for a.jpg
            {"id": "child-2"},        # container for b.jpg
            {"id": "carousel-ctr"},   # carousel parent
            {"id": "ig-media-333"},   # publish
        ]
        _mock_requests.get.return_value.json.side_effect = [
            {"status_code": "FINISHED"},
            {"permalink": "https://www.instagram.com/p/car"},
        ]
        with patch("services.ig_publisher.time.sleep"):
            result = publish_post(_PID)
        assert result["published"] is True

    # ── published notification email ──────────────────────────────────

    def test_sends_published_email_on_success(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher._send_published_email") as mock_email:
                publish_post(_PID)
        mock_email.assert_called_once()

    def test_published_email_receives_permalink(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher._send_published_email") as mock_email:
                publish_post(_PID)
        _, kwargs = mock_email.call_args
        assert kwargs["permalink"] == "https://www.instagram.com/p/xyz"

    def test_published_email_receives_ig_page(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher._send_published_email") as mock_email:
                publish_post(_PID)
        _, kwargs = mock_email.call_args
        assert kwargs["ig"]["ig_username"] == "test_ig_account"

    def test_published_email_post_has_published_at(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher._send_published_email") as mock_email:
                publish_post(_PID)
        _, kwargs = mock_email.call_args
        assert kwargs["post"].get("published_at") is not None

    def test_email_failure_does_not_raise(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher._send_published_email",
                       side_effect=Exception("resend down")):
                result = publish_post(_PID)   # must NOT raise
        assert result["published"] is True

    def test_no_email_sent_on_ig_error(self):
        self._stub_post(_DEFAULT_POST)
        _mock_requests.post.return_value.json.return_value = {"error": {"message": "rate limit"}}
        with patch("services.ig_publisher._send_published_email") as mock_email:
            with pytest.raises(HTTPException):
                publish_post(_PID)
        mock_email.assert_not_called()

    def test_send_published_email_uses_owner_email(self):
        self._stub_post(_DEFAULT_POST)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher.resend") as mock_r:
                publish_post(_PID)
        send_kwargs = mock_r.Emails.send.call_args[0][0]
        assert send_kwargs["to"] == "owner@test.com"

    def test_send_published_email_skipped_when_no_owner_email(self):
        post = {**_DEFAULT_POST, "businesses": {"name": "Biz", "owner_email": None}}
        self._stub_post(post)
        self._stub_ig_success()
        with patch("services.ig_publisher.time.sleep"):
            with patch("services.ig_publisher.resend") as mock_r:
                publish_post(_PID)
        mock_r.Emails.send.assert_not_called()
