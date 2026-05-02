from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str          # service role key — backend only

    # Meta / Facebook
    FB_APP_ID: str
    FB_APP_SECRET: str
    FB_REDIRECT_URI: str = "http://localhost:8000/auth/callback"

    # Anthropic
    ANTHROPIC_API_KEY: str

    # Google
    GOOGLE_API_KEY: str

    #Resend
    RESEND_API_KEY: str = ""

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "https://socio.app"]

    # Encryption key for access tokens (32 bytes base64)
    TOKEN_ENCRYPTION_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()
