from supabase import create_client, Client
from cryptography.fernet import Fernet
from config import settings
import base64

# ── Supabase ─────────────────────────────────────────────────────────
def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

supabase: Client = get_supabase()

# ── Token encryption ──────────────────────────────────────────────────
# TOKEN_ENCRYPTION_KEY must be a valid 32-byte Fernet key.
# Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

def _fernet() -> Fernet:
    key = settings.TOKEN_ENCRYPTION_KEY.encode()
    return Fernet(key)

def encrypt_token(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()
