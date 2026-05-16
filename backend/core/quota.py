from db.client import supabase
from fastapi import HTTPException

def consume_post_quota(business_id: str, post_type: str = "single") -> dict:
    result = supabase.rpc("consume_post_quota", {
        "biz_id":    business_id,
        "post_type": post_type,
    }).execute()
    row = (result.data or [None])[0]
    if not row:
        raise HTTPException(500, "Quota check failed.")
    if not row["allowed"]:
        msg = (
            "You've used your weekly carousel."
            if post_type == "carousel"
            else "You've used all 3 posts for this week."
        )
        raise HTTPException(429, f"{msg} Quota resets Monday.")
    return {"used": row["used"], "remaining": row["remaining"]}
