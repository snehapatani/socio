"""AI image generation via Google Imagen + storage upload."""

import uuid
import logging

from fastapi import HTTPException
from google import genai
from google.genai import types

from config import settings
from db.client import supabase

log = logging.getLogger(__name__)

_client = genai.Client(
    api_key=settings.GOOGLE_API_KEY,
    http_options=types.HttpOptions(api_version="v1beta"),
)

IMAGEN_MODEL = "models/imagen-4.0-generate-001"


async def generate_image_bytes(prompt: str) -> bytes:
    """Call Imagen, return raw image bytes."""
    log.info("Generating image with prompt: %s…", prompt[:50])
    response = await _client.aio.models.generate_images(
        model=IMAGEN_MODEL,
        prompt=prompt,
        config=types.GenerateImagesConfig(number_of_images=1),
    )
    return response.generated_images[0].image.image_bytes


def _build_prompt(business_type: str, context: dict) -> str:
    if context:
        style = "\n".join(f"- {k}: {v}" for k, v in context.items())
    else:
        style = "modern, clean"
    return (
        f"High-quality professional social media photography for a {business_type} business. "
        f"Style:\n{style}\n"
        f"Vibrant, clean, square aspect ratio, no text."
    )


async def generate_and_store_image(business_id: str) -> dict:
    """Generate an image for a business, upload to storage,
    insert a media_library row, and return URL info.
    """
    biz_resp = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
    if not biz_resp.data:
        raise HTTPException(404, "Business not found")
    business = biz_resp.data

    prompt = _build_prompt(
        business.get("business_type", "lifestyle"),
        business.get("business_context") or {},
    )
    image_bytes = await generate_image_bytes(prompt)

    media_id = str(uuid.uuid4())
    path = f"businesses/{business_id}/library/{media_id}.jpeg"

    supabase.storage.from_("media").upload(
        path=path,
        file=image_bytes,
        file_options={"content-type": "image/jpeg"},
    )

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/media/{path}"

    supabase.table("media_library").insert({
        "business_id":  business_id,
        "media_url":    public_url,
        "storage_path": path,
        "times_used":   0,
        "is_active":    True,
        "content_type": "image/jpeg",
    }).execute()

    return {
        "media_url":          public_url,
        "media_storage_path": path,
        "business_id":        business_id,
    }
