"""JWT verification + role-based access for FastAPI routes.

Supabase issues HS256-signed JWTs. We verify them with the project's
JWT secret (Supabase dashboard → Project Settings → API → JWT Secret),
extract the user id (`sub`) and email, then optionally check role
against the `profiles` table.
"""

from fastapi import Header, HTTPException, Depends
from typing import Optional
from jose import jwt, JWTError

from config import settings
from db.client import supabase
from functools import lru_cache
import httpx

# ── JWKS cache ───────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _jwks() -> dict:
    """Fetch Supabase's public keys. Cached for the process lifetime.

    If you rotate JWT keys in production, restart the server (or wrap
    this with a TTL cache instead).
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    return resp.json()


def _find_key(kid: str) -> dict:
    for key in _jwks().get("keys", []):
        if key.get("kid") == kid:
            return key
    raise JWTError(f"No JWKS key found for kid={kid}")

# ── Extract & verify ─────────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header.")
    token = authorization.split(" ", 1)[1]

    try:
        header = jwt.get_unverified_header(token)
        alg    = header.get("alg")

        if alg == "HS256":
            # Legacy symmetric secret
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},   # Supabase aud is 'authenticated'
            )
        else:
            # Asymmetric (ES256 / RS256) — verify against JWKS public key
            key = _find_key(header.get("kid"))
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                options={"verify_aud": False},
            )
    except JWTError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token missing 'sub' claim.")

    return {"id": user_id, "email": payload.get("email"), "raw": payload}


# ── Admin role guard ────────────────────────────────────────────────
def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Verify the user has profiles.role = 'admin'.

    Costs one extra query per admin request. If you call admin routes
    in tight loops, cache the role in a request-scoped cache or move
    role into Supabase Auth app_metadata so it's signed into the JWT.
    """
    res = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user["id"])
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(403, "Profile not found.")
    if res.data.get("role") != "admin":
        raise HTTPException(403, "Admin access required.")
    return user


# ── Owner-or-admin guard (for business-scoped routes) ───────────────
def require_owner_or_admin(business_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Allow if user owns the business OR is an admin."""
    biz = (
        supabase.table("businesses")
        .select("owner_id")
        .eq("id", business_id)
        .single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(404, "Business not found.")

    if biz.data.get("owner_id") == user["id"]:
        return user

    # Fall back to admin check
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user["id"])
        .single()
        .execute()
    )
    if profile.data and profile.data.get("role") == "admin":
        return user

    raise HTTPException(403, "Not authorized for this business.")
