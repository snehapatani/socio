from cryptography.fernet import Fernet
from config import settings

# TOKEN_ENCRYPTION_KEY must be a valid 32-byte Fernet key.
# Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

def _fernet() -> Fernet:
    return Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())

def encrypt_token(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()
