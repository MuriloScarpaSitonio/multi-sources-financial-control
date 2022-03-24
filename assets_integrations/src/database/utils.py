from cryptography.fernet import Fernet

from ..settings import FERNET_KEY


def decrypt(value: bytes) -> str:
    decrypted_value = Fernet(key=FERNET_KEY).decrypt(token=value)
    return str(decrypted_value, "utf-8")
