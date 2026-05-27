"""Best-time slot selection for scheduling next week's posts.

Analyses past post_insights to find top day+hour combinations by
(reach + 3×saves). Falls back to sensible defaults if data is thin.

Overlap prevention: queries already-scheduled posts for the target week
and finds the next free slot when the preferred one is taken.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from db.client import supabase

MIN_DATA_POSTS = 6
FALLBACK_SLOTS = [(0, 18), (2, 12), (4, 17)]   # Mon 6pm, Wed 12pm, Fri 5pm

# Acceptable posting hours tried in order when the preferred hour is taken
_CANDIDATE_HOURS = [9, 12, 15, 18, 21]


def get_best_schedule(business_id: str) -> list[datetime]:
    """Return up to 3 UTC datetimes for next week, guaranteed non-overlapping."""
    now          = datetime.now(timezone.utc)
    next_monday  = _next_monday(now)
    week_end     = next_monday + timedelta(days=7)

    occupied = _occupied_slots(business_id, next_monday, week_end)
    preferred = _ranked_slots(business_id)

    chosen: list[tuple[int, int]] = []
    used_days: set[int] = set()

    for weekday, hour in preferred:
        if len(chosen) == 3:
            break
        if weekday in used_days:
            continue
        slot = _next_free_slot(weekday, hour, occupied)
        if slot:
            chosen.append(slot)
            occupied.add(slot)
            used_days.add(slot[0])

    # Fill remaining slots from the fallback list
    for weekday, hour in FALLBACK_SLOTS:
        if len(chosen) == 3:
            break
        if weekday in used_days:
            continue
        slot = _next_free_slot(weekday, hour, occupied)
        if slot:
            chosen.append(slot)
            occupied.add(slot)
            used_days.add(slot[0])

    # Last resort: walk every day of the week until we have 3
    for weekday in range(7):
        if len(chosen) == 3:
            break
        if weekday in used_days:
            continue
        slot = _next_free_slot(weekday, 12, occupied)
        if slot:
            chosen.append(slot)
            occupied.add(slot)
            used_days.add(slot[0])

    chosen.sort(key=lambda x: x[0])
    return [next_monday + timedelta(days=wd, hours=h) for wd, h in chosen]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _next_monday(now: datetime) -> datetime:
    days_ahead = (7 - now.weekday()) % 7 or 7
    return (now + timedelta(days=days_ahead)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _occupied_slots(
    business_id: str,
    week_start: datetime,
    week_end: datetime,
) -> set[tuple[int, int]]:
    """Return (weekday, hour) pairs already scheduled for this business next week."""
    rows = (
        supabase.table("posts")
        .select("scheduled_at")
        .eq("business_id", business_id)
        .in_("status", ["pending_approval", "approved", "scheduled"])
        .gte("scheduled_at", week_start.isoformat())
        .lt("scheduled_at", week_end.isoformat())
        .execute()
    )
    slots: set[tuple[int, int]] = set()
    for p in (rows.data or []):
        ts = p.get("scheduled_at")
        if ts:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            slots.add((dt.weekday(), dt.hour))
    return slots


def _next_free_slot(
    weekday: int,
    preferred_hour: int,
    occupied: set[tuple[int, int]],
) -> tuple[int, int] | None:
    """Return the nearest free slot starting from preferred_hour on weekday.

    Tries every candidate hour on the same day first. Returns None only if
    all candidate hours on that day are taken.
    """
    candidates = [preferred_hour] + [h for h in _CANDIDATE_HOURS if h != preferred_hour]
    for hour in candidates:
        if (weekday, hour) not in occupied:
            return (weekday, hour)
    return None


def _ranked_slots(business_id: str) -> list[tuple[int, int]]:
    """Return (weekday, hour) pairs ranked by past engagement, or fallback."""
    published = (
        supabase.table("posts")
        .select("id, scheduled_at")
        .eq("business_id", business_id)
        .eq("status", "published")
        .execute()
    )

    if not published.data or len(published.data) < MIN_DATA_POSTS:
        return list(FALLBACK_SLOTS)

    post_ids   = [p["id"] for p in published.data]
    post_times = {p["id"]: p["scheduled_at"] for p in published.data}

    insights = (
        supabase.table("post_insights")
        .select("post_id, reach, saved, fetched_at")
        .in_("post_id", post_ids)
        .order("fetched_at", desc=True)
        .execute()
    )

    slot_scores: dict[tuple[int, int], list[int]] = defaultdict(list)
    seen: set[str] = set()
    for ins in (insights.data or []):
        pid = ins["post_id"]
        if pid in seen:
            continue
        seen.add(pid)

        ts = post_times.get(pid)
        if not ts:
            continue

        dt    = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        slot  = (dt.weekday(), (dt.hour // 3) * 3)
        score = (ins.get("reach") or 0) + (ins.get("saved") or 0) * 3
        slot_scores[slot].append(score)

    if not slot_scores:
        return list(FALLBACK_SLOTS)

    avg_scores = {slot: sum(s) / len(s) for slot, s in slot_scores.items()}
    return [slot for slot, _ in sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)]
