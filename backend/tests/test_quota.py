"""Tests for core/quota.py"""
import sys
from unittest.mock import MagicMock

_mock_supabase = MagicMock()
sys.modules["db"]        = MagicMock()
sys.modules["db.client"] = MagicMock(supabase=_mock_supabase)

import pytest
from fastapi import HTTPException
from core.quota import consume_post_quota

_BID = "biz-abc"


class TestConsumePostQuota:
    def setup_method(self):
        _mock_supabase.reset_mock()

    def _stub(self, data):
        _mock_supabase.rpc.return_value.execute.return_value.data = data

    def test_raises_500_on_empty_list(self):
        self._stub([])
        with pytest.raises(HTTPException) as exc:
            consume_post_quota(_BID)
        assert exc.value.status_code == 500

    def test_raises_500_on_none_data(self):
        self._stub(None)
        with pytest.raises(HTTPException) as exc:
            consume_post_quota(_BID)
        assert exc.value.status_code == 500

    def test_raises_429_when_single_quota_exceeded(self):
        self._stub([{"allowed": False, "used": 3, "remaining": 0}])
        with pytest.raises(HTTPException) as exc:
            consume_post_quota(_BID, "single")
        assert exc.value.status_code == 429
        assert "3 posts" in exc.value.detail

    def test_raises_429_when_carousel_quota_exceeded(self):
        self._stub([{"allowed": False, "used": 1, "remaining": 0}])
        with pytest.raises(HTTPException) as exc:
            consume_post_quota(_BID, "carousel")
        assert exc.value.status_code == 429
        assert "carousel" in exc.value.detail.lower()

    def test_429_mentions_reset_day(self):
        self._stub([{"allowed": False, "used": 3, "remaining": 0}])
        with pytest.raises(HTTPException) as exc:
            consume_post_quota(_BID)
        assert "Monday" in exc.value.detail

    def test_returns_used_and_remaining_when_allowed(self):
        self._stub([{"allowed": True, "used": 1, "remaining": 2}])
        result = consume_post_quota(_BID)
        assert result == {"used": 1, "remaining": 2}

    def test_calls_rpc_with_correct_table_and_type(self):
        self._stub([{"allowed": True, "used": 0, "remaining": 1}])
        consume_post_quota(_BID, "carousel")
        _mock_supabase.rpc.assert_called_once_with(
            "consume_post_quota",
            {"biz_id": _BID, "post_type": "carousel"},
        )

    def test_default_post_type_is_single(self):
        self._stub([{"allowed": True, "used": 0, "remaining": 3}])
        consume_post_quota(_BID)
        call_kwargs = _mock_supabase.rpc.call_args.args[1]
        assert call_kwargs["post_type"] == "single"
