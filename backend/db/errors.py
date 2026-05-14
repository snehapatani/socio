from enum import Enum
from typing import Optional
import logging

from fastapi import HTTPException
from postgrest.exceptions import APIError

log = logging.getLogger(__name__)


class PGError(str, Enum):
    """Postgres SQLSTATE codes we handle explicitly.
    Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
    """
    UNIQUE_VIOLATION      = "23505"
    FOREIGN_KEY_VIOLATION = "23503"
    NOT_NULL_VIOLATION    = "23502"
    CHECK_VIOLATION       = "23514"


def _extract(e: APIError) -> tuple[Optional[str], str]:
    """Pull (code, details) out of a postgrest APIError in a version-tolerant way.
    Older postgrest-py versions stash the dict on e.args[0]; newer versions
    expose code/details as attributes.
    """
    code = getattr(e, "code", None) or (e.args[0].get("code") if e.args else None)
    details = (
        getattr(e, "details", None)
        or (e.args[0].get("details") if e.args else None)
        or ""
    )
    return code, details


def handle_pg_error(
    e: APIError,
    *,
    on_conflict: str = "That record already exists.",
    on_conflict_fields: Optional[dict[str, str]] = None,
) -> None:
    """Translate a postgrest APIError into a clean FastAPI HTTPException.

    Args:
        e: The APIError raised by supabase / postgrest.
        on_conflict: Default message for unique-violation conflicts (409).
        on_conflict_fields: Per-column overrides for unique violations, e.g.
            {"owner_email": "An account with this email already exists."}

    Always raises — never returns.
    """
    code, details = _extract(e)

    if code == PGError.UNIQUE_VIOLATION:
        if on_conflict_fields:
            for field, msg in on_conflict_fields.items():
                if field in details:
                    raise HTTPException(409, msg)
        raise HTTPException(409, on_conflict)

    if code == PGError.NOT_NULL_VIOLATION:
        raise HTTPException(400, "Missing a required field.")

    if code == PGError.CHECK_VIOLATION:
        raise HTTPException(400, "One of the values isn't valid.")

    if code == PGError.FOREIGN_KEY_VIOLATION:
        raise HTTPException(400, "Referenced record doesn't exist.")

    # Unknown DB error — log full detail server-side, return generic to client
    log.exception("Unhandled DB error: code=%s details=%s", code, details)
    raise HTTPException(500, "A database error occurred. Please try again.")
