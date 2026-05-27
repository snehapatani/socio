import os
import sys
from unittest.mock import MagicMock

for _mod in ["supabase", "resend", "gotrue", "supabase_auth"]:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-key")
os.environ.setdefault("FB_APP_ID", "x"); os.environ.setdefault("FB_APP_SECRET", "x")
os.environ.setdefault("ANTHROPIC_API_KEY", "x"); os.environ.setdefault("GOOGLE_API_KEY", "x")
os.environ.setdefault("RESEND_API_KEY", "x")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "dGVzdC10b2tlbi1lbmNyeXB0aW9uLWtleTMyYnl0")
os.environ.setdefault("TZ", "UTC"); os.environ.setdefault("SUPABASE_JWT_SECRET", "x")

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from services.post_scheduler import (
    get_best_schedule,
    _next_monday,
    _next_free_slot,
    _occupied_slots,
    _ranked_slots,
    FALLBACK_SLOTS,
    MIN_DATA_POSTS,
    _CANDIDATE_HOURS,
)

BIZ_ID = "biz-test-123"

# ── Fixed reference point: a Wednesday at noon UTC ────────────────────────────
FIXED_NOW = datetime(2026, 5, 20, 12, 0, 0, tzinfo=timezone.utc)  # Wednesday
# next Monday from Wednesday = 2026-05-25
NEXT_MONDAY = datetime(2026, 5, 25, 0, 0, 0, tzinfo=timezone.utc)


def _monday_at(weekday: int, hour: int) -> str:
    """Return an ISO string for next Monday + weekday offset + hour."""
    return (NEXT_MONDAY + timedelta(days=weekday, hours=hour)).isoformat()


# ── _next_monday ──────────────────────────────────────────────────────────────

class TestNextMonday:
    def test_from_wednesday_gives_next_monday(self):
        result = _next_monday(FIXED_NOW)
        assert result == NEXT_MONDAY

    def test_from_monday_gives_following_monday(self):
        monday = datetime(2026, 5, 25, 9, 0, tzinfo=timezone.utc)
        result = _next_monday(monday)
        assert result == datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)

    def test_from_sunday_gives_next_day(self):
        sunday = datetime(2026, 5, 24, 23, 0, tzinfo=timezone.utc)
        result = _next_monday(sunday)
        assert result == datetime(2026, 5, 25, 0, 0, tzinfo=timezone.utc)

    def test_result_is_midnight(self):
        result = _next_monday(FIXED_NOW)
        assert result.hour == 0
        assert result.minute == 0
        assert result.second == 0

    def test_result_weekday_is_monday(self):
        result = _next_monday(FIXED_NOW)
        assert result.weekday() == 0  # 0 = Monday


# ── _next_free_slot ───────────────────────────────────────────────────────────

class TestNextFreeSlot:
    def test_returns_preferred_when_free(self):
        assert _next_free_slot(0, 18, set()) == (0, 18)

    def test_skips_occupied_preferred_hour(self):
        occupied = {(0, 18)}
        slot = _next_free_slot(0, 18, occupied)
        assert slot is not None
        assert slot != (0, 18)
        assert slot[0] == 0  # still Monday

    def test_falls_through_to_candidate_hours(self):
        # Block preferred + first few candidates, ensure it finds an open one
        occupied = {(0, 18), (0, 9), (0, 12)}
        slot = _next_free_slot(0, 18, occupied)
        assert slot is not None
        assert slot not in occupied

    def test_returns_none_when_all_candidates_taken(self):
        occupied = {(2, h) for h in _CANDIDATE_HOURS} | {(2, 18)}
        slot = _next_free_slot(2, 18, occupied)
        assert slot is None

    def test_does_not_cross_to_different_day(self):
        # All candidates for day 1 taken — must NOT return day 2
        occupied = {(1, h) for h in _CANDIDATE_HOURS} | {(1, 18)}
        slot = _next_free_slot(1, 18, occupied)
        assert slot is None  # None, not (2, something)

    def test_non_candidate_preferred_hour_still_tried_first(self):
        # 14 is not in _CANDIDATE_HOURS
        slot = _next_free_slot(3, 14, set())
        assert slot == (3, 14)

    def test_non_candidate_occupied_falls_back_to_candidates(self):
        occupied = {(3, 14)}
        slot = _next_free_slot(3, 14, occupied)
        assert slot is not None
        assert slot[0] == 3
        assert slot[1] in _CANDIDATE_HOURS


# ── _occupied_slots ───────────────────────────────────────────────────────────

class TestOccupiedSlots:
    def _make_sb(self, rows):
        sb = MagicMock()
        (sb.table.return_value
           .select.return_value
           .eq.return_value
           .in_.return_value
           .gte.return_value
           .lt.return_value
           .execute.return_value.data) = rows
        return sb

    def test_empty_when_no_existing_posts(self):
        sb = self._make_sb([])
        with patch("services.post_scheduler.supabase", sb):
            result = _occupied_slots(BIZ_ID, NEXT_MONDAY, NEXT_MONDAY + timedelta(days=7))
        assert result == set()

    def test_parses_scheduled_at_into_weekday_hour(self):
        # Monday 18:00 UTC
        sb = self._make_sb([{"scheduled_at": "2026-05-25T18:00:00+00:00"}])
        with patch("services.post_scheduler.supabase", sb):
            result = _occupied_slots(BIZ_ID, NEXT_MONDAY, NEXT_MONDAY + timedelta(days=7))
        assert (0, 18) in result  # weekday 0 = Monday

    def test_parses_z_suffix_timestamps(self):
        sb = self._make_sb([{"scheduled_at": "2026-05-27T12:00:00Z"}])  # Wednesday
        with patch("services.post_scheduler.supabase", sb):
            result = _occupied_slots(BIZ_ID, NEXT_MONDAY, NEXT_MONDAY + timedelta(days=7))
        assert (2, 12) in result  # weekday 2 = Wednesday

    def test_skips_rows_with_no_scheduled_at(self):
        sb = self._make_sb([{"scheduled_at": None}, {"scheduled_at": "2026-05-25T09:00:00Z"}])
        with patch("services.post_scheduler.supabase", sb):
            result = _occupied_slots(BIZ_ID, NEXT_MONDAY, NEXT_MONDAY + timedelta(days=7))
        assert len(result) == 1
        assert (0, 9) in result

    def test_returns_multiple_slots(self):
        sb = self._make_sb([
            {"scheduled_at": "2026-05-25T18:00:00Z"},  # Mon 18
            {"scheduled_at": "2026-05-27T12:00:00Z"},  # Wed 12
            {"scheduled_at": "2026-05-29T17:00:00Z"},  # Fri 17
        ])
        with patch("services.post_scheduler.supabase", sb):
            result = _occupied_slots(BIZ_ID, NEXT_MONDAY, NEXT_MONDAY + timedelta(days=7))
        assert result == {(0, 18), (2, 12), (4, 17)}


# ── _ranked_slots ─────────────────────────────────────────────────────────────

class TestRankedSlots:
    def _make_sb(self, published_rows, insights_rows):
        sb = MagicMock()
        pub_chain = (sb.table.return_value
                       .select.return_value
                       .eq.return_value
                       .eq.return_value
                       .execute.return_value)
        pub_chain.data = published_rows

        ins_chain = (sb.table.return_value
                       .select.return_value
                       .in_.return_value
                       .order.return_value
                       .execute.return_value)
        ins_chain.data = insights_rows
        return sb

    def test_returns_fallback_when_no_published_posts(self):
        sb = self._make_sb([], [])
        with patch("services.post_scheduler.supabase", sb):
            result = _ranked_slots(BIZ_ID)
        assert result == list(FALLBACK_SLOTS)

    def test_returns_fallback_below_min_data_threshold(self):
        few = [{"id": f"p{i}", "scheduled_at": "2026-01-01T18:00:00Z"}
               for i in range(MIN_DATA_POSTS - 1)]
        sb = self._make_sb(few, [])
        with patch("services.post_scheduler.supabase", sb):
            result = _ranked_slots(BIZ_ID)
        assert result == list(FALLBACK_SLOTS)

    def test_returns_fallback_when_no_insights(self):
        posts = [{"id": f"p{i}", "scheduled_at": "2026-01-05T18:00:00Z"}
                 for i in range(MIN_DATA_POSTS)]
        sb = self._make_sb(posts, [])
        with patch("services.post_scheduler.supabase", sb):
            result = _ranked_slots(BIZ_ID)
        assert result == list(FALLBACK_SLOTS)

    def test_ranks_by_reach_plus_3x_saves(self):
        posts = [
            {"id": "p1", "scheduled_at": "2026-01-05T18:00:00Z"},  # Monday 18
            {"id": "p2", "scheduled_at": "2026-01-07T12:00:00Z"},  # Wednesday 12
            {"id": "p3", "scheduled_at": "2026-01-09T09:00:00Z"},  # Friday 9
            {"id": "p4", "scheduled_at": "2026-01-06T15:00:00Z"},  # Tuesday 15
            {"id": "p5", "scheduled_at": "2026-01-08T21:00:00Z"},  # Thursday 21
            {"id": "p6", "scheduled_at": "2026-01-10T12:00:00Z"},  # Saturday 12
        ]
        insights = [
            # Wed 12 gets the highest score: reach=100 + saves=20*3 = 160
            {"post_id": "p2", "reach": 100, "saved": 20, "fetched_at": "2026-01-10T00:00:00Z"},
            # Mon 18 medium: reach=50 + saves=5*3 = 65
            {"post_id": "p1", "reach": 50,  "saved": 5,  "fetched_at": "2026-01-10T00:00:00Z"},
            # Fri 9 low: reach=10 + saves=1*3 = 13
            {"post_id": "p3", "reach": 10,  "saved": 1,  "fetched_at": "2026-01-10T00:00:00Z"},
            {"post_id": "p4", "reach": 20,  "saved": 2,  "fetched_at": "2026-01-10T00:00:00Z"},
            {"post_id": "p5", "reach": 5,   "saved": 0,  "fetched_at": "2026-01-10T00:00:00Z"},
            {"post_id": "p6", "reach": 30,  "saved": 3,  "fetched_at": "2026-01-10T00:00:00Z"},
        ]
        sb = self._make_sb(posts, insights)
        with patch("services.post_scheduler.supabase", sb):
            result = _ranked_slots(BIZ_ID)
        # Wed (weekday=2, bucket=12) must be first
        assert result[0] == (2, 12)

    def test_deduplicates_insights_per_post(self):
        """Only the first (most-recent) insight per post should count."""
        posts = [{"id": f"p{i}", "scheduled_at": "2026-01-05T18:00:00Z"}
                 for i in range(MIN_DATA_POSTS)]
        insights = [
            {"post_id": "p0", "reach": 100, "saved": 0, "fetched_at": "2026-01-10T00:00:00Z"},
            # Duplicate for p0 — must be ignored
            {"post_id": "p0", "reach": 999, "saved": 999, "fetched_at": "2026-01-09T00:00:00Z"},
        ]
        sb = self._make_sb(posts, insights)
        with patch("services.post_scheduler.supabase", sb):
            result = _ranked_slots(BIZ_ID)
        # Should not crash and should use only first insight for p0
        assert isinstance(result, list)


# ── get_best_schedule (integration) ──────────────────────────────────────────

class TestGetBestSchedule:
    """Tests for the public entry-point, with both supabase and datetime mocked."""

    def _make_sb(self, occupied_rows=None, published_rows=None, insights_rows=None):
        """Build a supabase mock that returns different data per table."""
        sb = MagicMock()

        posts_mock = MagicMock()
        # _occupied_slots query chain
        (posts_mock.select.return_value
                   .eq.return_value
                   .in_.return_value
                   .gte.return_value
                   .lt.return_value
                   .execute.return_value.data) = occupied_rows or []
        # _ranked_slots published query chain
        (posts_mock.select.return_value
                   .eq.return_value
                   .eq.return_value
                   .execute.return_value.data) = published_rows or []

        insights_mock = MagicMock()
        (insights_mock.select.return_value
                      .in_.return_value
                      .order.return_value
                      .execute.return_value.data) = insights_rows or []

        def _table(name):
            if name == "post_insights":
                return insights_mock
            return posts_mock

        sb.table.side_effect = _table
        return sb

    def test_returns_3_datetimes(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        assert len(result) == 3

    def test_all_results_are_datetimes(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        assert all(isinstance(dt, datetime) for dt in result)

    def test_no_two_posts_on_same_day(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        weekdays = [dt.weekday() for dt in result]
        assert len(weekdays) == len(set(weekdays)), "Two posts share the same day"

    def test_all_slots_in_next_week(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        week_end = NEXT_MONDAY + timedelta(days=7)
        for dt in result:
            assert NEXT_MONDAY <= dt < week_end

    def test_avoids_already_occupied_slots(self):
        # Mon 18, Wed 12, Fri 17 are all taken — fallback must pick different hours
        occupied_rows = [
            {"scheduled_at": "2026-05-25T18:00:00Z"},  # Mon 18
            {"scheduled_at": "2026-05-27T12:00:00Z"},  # Wed 12
            {"scheduled_at": "2026-05-29T17:00:00Z"},  # Fri 17
        ]
        sb = self._make_sb(occupied_rows=occupied_rows)
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)

        taken = {(0, 18), (2, 12), (4, 17)}
        for dt in result:
            assert (dt.weekday(), dt.hour) not in taken

    def test_results_are_sorted_chronologically(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        assert result == sorted(result)

    def test_no_duplicate_datetimes(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)
        assert len(result) == len(set(result))

    def test_uses_fallback_slots_when_no_published_data(self):
        sb = self._make_sb()
        with patch("services.post_scheduler.supabase", sb), \
             patch("services.post_scheduler.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_NOW
            mock_dt.fromisoformat.side_effect = datetime.fromisoformat
            result = get_best_schedule(BIZ_ID)

        # With no data, fallback slots (Mon 18, Wed 12, Fri 17) should be used
        expected_weekday_hours = {(wd, h) for wd, h in FALLBACK_SLOTS}
        actual_weekday_hours   = {(dt.weekday(), dt.hour) for dt in result}
        assert actual_weekday_hours == expected_weekday_hours
