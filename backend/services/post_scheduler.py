"""Best-time slot selection for scheduling next week's posts.

Analyzes past post_insights to find top day+hour combinations by
(reach + 3×saves). Falls back to sensible defaults if data is thin.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from db.client import supabase

MIN_DATA_POSTS = 6                    # need this many published posts to do analysis
FALLBACK_SLOTS = [(0, 18), (2, 12), (4, 17)]   # Mon 6pm, Wed 12pm, Fri 5pm


def get_best_schedule(business_id: str) -> list[datetime]:
    """Return 3 UTC datetimes for next week's post schedule."""
    published = (
        supabase.table("posts")
        .select("id, scheduled_at")
        .eq("business_id", business_id)
        .eq("status", "published")
        .execute()
    )

    if not published.data or len(published.data) < MIN_DATA_POSTS:
        return _build_schedule(FALLBACK_SLOTS)

    post_ids = [p["id"] for p in published.data]
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

        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        slot = (dt.weekday(), (dt.hour // 3) * 3)   # bucket into 3-hour windows

        score = (ins.get("reach") or 0) + (ins.get("saved") or 0) * 3
        slot_scores[slot].append(score)

    if not slot_scores:
        return _build_schedule(FALLBACK_SLOTS)

    avg_scores = {slot: sum(scores) / len(scores) for slot, scores in slot_scores.items()}
    ranked = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)

    chosen: list[tuple[int, int]] = []
    used_days: set[int] = set()
    for (weekday, hour), _ in ranked:
        if weekday not in used_days:
            chosen.append((weekday, hour))
            used_days.add(weekday)
        if len(chosen) == 3:
            break

    # Fill remaining slots from fallback
    for day, hour in FALLBACK_SLOTS:
        if len(chosen) == 3:
            break
        if day not in used_days:
            chosen.append((day, hour))
            used_days.add(day)

    chosen.sort(key=lambda x: x[0])
    return _build_schedule(chosen)


def _build_schedule(day_hour_pairs: list[tuple[int, int]]) -> list[datetime]:
    """Turn (weekday, hour) pairs into UTC datetimes for next week."""
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    next_monday = (now + timedelta(days=days_until_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return [next_monday + timedelta(days=wd, hours=h) for wd, h in day_hour_pairs]
