"""Tests for services/media_selector.py"""
import sys
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone

# ── Block external deps before import ─────────────────────────────────────────
_mock_supabase = MagicMock()
sys.modules["db"]        = MagicMock()
sys.modules["db.client"] = MagicMock(supabase=_mock_supabase)
sys.modules["config"]    = MagicMock()

import pytest
from fastapi import HTTPException
from services.media_selector import pick_media_for_generation, _score_photos_by_engagement, COOLDOWN_WEEKS

_BID = "biz-123"


def _photo(id, times_used=0, last_used_at=None, **kw):
    return {
        "id": id,
        "media_url": f"https://cdn.test/{id}.jpg",
        "storage_path": f"media/{id}.jpg",
        "content_type": "image/jpeg",
        "times_used": times_used,
        "last_used_at": last_used_at,
        **kw,
    }


def _old():
    return (datetime.now(timezone.utc) - timedelta(weeks=COOLDOWN_WEEKS + 1)).isoformat()


def _recent():
    return (datetime.now(timezone.utc) - timedelta(weeks=1)).isoformat()


def _mock_library(photos):
    """Patch the chained supabase call that fetches the media library."""
    (
        _mock_supabase.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .execute.return_value.data
    ) = photos


class TestPickMediaForGeneration:
    def setup_method(self):
        _mock_supabase.reset_mock()

    def test_raises_400_on_empty_library(self):
        _mock_library([])
        with pytest.raises(HTTPException) as exc:
            pick_media_for_generation(_BID)
        assert exc.value.status_code == 400
        assert "No photos" in exc.value.detail

    def test_returns_fresh_media(self):
        _mock_library([_photo(f"p{i}") for i in range(3)])
        result = pick_media_for_generation(_BID)
        assert len(result) == 3

    def test_raises_400_when_not_enough_total_media(self):
        _mock_library([_photo("only-one")])
        with pytest.raises(HTTPException) as exc:
            pick_media_for_generation(_BID, count=3)
        assert exc.value.status_code == 400

    def test_returns_exactly_count_items(self):
        _mock_library([_photo(f"p{i}") for i in range(5)])
        result = pick_media_for_generation(_BID, count=2)
        assert len(result) == 2

    def test_fresh_media_comes_before_reusable(self):
        reusable = _photo("old", times_used=2, last_used_at=_old())
        fresh    = _photo("new", times_used=0)
        _mock_library([reusable, fresh])

        # Stub the engagement-scoring supabase call so it doesn't crash
        (
            _mock_supabase.table.return_value
            .select.return_value
            .overlaps.return_value
            .eq.return_value
            .execute.return_value.data
        ) = []

        result = pick_media_for_generation(_BID, count=1)
        assert result[0]["id"] == "new"

    def test_reusable_within_cooldown_is_excluded(self):
        recent_photo = _photo("r1", times_used=1, last_used_at=_recent())
        fresh_photo  = _photo("f1")
        _mock_library([recent_photo, fresh_photo])
        result = pick_media_for_generation(_BID, count=1)
        assert result[0]["id"] == "f1"

    def test_reusable_past_cooldown_is_included(self):
        old_photo = _photo("o1", times_used=1, last_used_at=_old())
        _mock_library([old_photo])

        (
            _mock_supabase.table.return_value
            .select.return_value
            .overlaps.return_value
            .eq.return_value
            .execute.return_value.data
        ) = []

        result = pick_media_for_generation(_BID, count=1)
        assert result[0]["id"] == "o1"

    def test_raises_400_detail_mentions_available_count(self):
        _mock_library([_photo("p1")])
        with pytest.raises(HTTPException) as exc:
            pick_media_for_generation(_BID, count=3)
        assert "1" in exc.value.detail


class TestScorePhotosByEngagement:
    def setup_method(self):
        _mock_supabase.reset_mock()

    def _stub_queries(self, posts_data, insights_data):
        sb = _mock_supabase.table.return_value.select.return_value
        sb.overlaps.return_value.eq.return_value.execute.return_value.data      = posts_data
        sb.in_.return_value.order.return_value.execute.return_value.data         = insights_data

    def test_returns_photos_unchanged_when_no_posts(self):
        self._stub_queries([], [])
        photos = [_photo("a"), _photo("b")]
        result = _score_photos_by_engagement(_BID, photos)
        assert [p["id"] for p in result] == ["a", "b"]

    def test_score_formula_reach_plus_3x_saves(self):
        photos = [_photo("p1")]
        self._stub_queries(
            posts_data=[{"id": "post1", "media_library_ids": ["p1"]}],
            insights_data=[{"post_id": "post1", "reach": 100, "saved": 10, "fetched_at": "2026-01-01"}],
        )
        result = _score_photos_by_engagement(_BID, photos)
        # 100 + 10*3 = 130
        assert result[0]["_score"] == 130.0

    def test_deduplicates_insights_takes_first_by_fetched_at(self):
        photos = [_photo("p1")]
        self._stub_queries(
            posts_data=[{"id": "post1", "media_library_ids": ["p1"]}],
            # Two rows for the same post — only first should count
            insights_data=[
                {"post_id": "post1", "reach": 200, "saved": 0, "fetched_at": "2026-01-02"},
                {"post_id": "post1", "reach": 100, "saved": 0, "fetched_at": "2026-01-01"},
            ],
        )
        result = _score_photos_by_engagement(_BID, photos)
        assert result[0]["_score"] == 200.0

    def test_sorted_highest_score_first(self):
        low  = _photo("low")
        high = _photo("high")
        self._stub_queries(
            posts_data=[
                {"id": "post_low",  "media_library_ids": ["low"]},
                {"id": "post_high", "media_library_ids": ["high"]},
            ],
            insights_data=[
                {"post_id": "post_low",  "reach": 10,  "saved": 0, "fetched_at": "2026-01-01"},
                {"post_id": "post_high", "reach": 500, "saved": 5, "fetched_at": "2026-01-01"},
            ],
        )
        result = _score_photos_by_engagement(_BID, [low, high])
        assert result[0]["id"] == "high"
        assert result[1]["id"] == "low"

    def test_carousel_photo_inherits_post_score(self):
        # post1 contains both p1 and p2 (a carousel)
        photos = [_photo("p1"), _photo("p2")]
        self._stub_queries(
            posts_data=[{"id": "post1", "media_library_ids": ["p1", "p2"]}],
            insights_data=[{"post_id": "post1", "reach": 300, "saved": 0, "fetched_at": "2026-01-01"}],
        )
        result = _score_photos_by_engagement(_BID, photos)
        assert result[0]["_score"] == 300.0
        assert result[1]["_score"] == 300.0

    def test_photos_outside_query_set_ignored(self):
        photos = [_photo("p1")]  # p2 not in our set
        self._stub_queries(
            posts_data=[{"id": "post1", "media_library_ids": ["p1", "p2"]}],
            insights_data=[{"post_id": "post1", "reach": 100, "saved": 0, "fetched_at": "2026-01-01"}],
        )
        result = _score_photos_by_engagement(_BID, photos)
        assert result[0]["_score"] == 100.0
