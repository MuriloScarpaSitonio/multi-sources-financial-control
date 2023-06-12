from typing import Any, TYPE_CHECKING

from cryptography.fernet import Fernet

from django.conf import settings
from django.db.models import CharField
from django.utils.encoding import force_bytes, force_str
from django.utils.functional import cached_property

if TYPE_CHECKING:
    from django.db.backends.base.base import BaseDatabaseWrapper


class EncryptedField(CharField):
    description = "Save encrypted data to DB an read as string on application level."

    def __init__(self, *args, **kwargs):
        kwargs["max_length"] = 1000
        super().__init__(*args, **kwargs)

    @cached_property
    def fernet(self) -> Fernet:
        return Fernet(key=settings.FERNET_KEY)

    def get_internal_type(self) -> str:
        return "BinaryField"

    def get_db_prep_save(self, value: Any, connection: "BaseDatabaseWrapper") -> memoryview | None:
        value = super().get_db_prep_save(value, connection)
        if value is not None:
            encrypted_value = self.fernet.encrypt(data=force_bytes(s=value))
            return connection.Database.Binary(encrypted_value)

    def from_db_value(self, value: bytes, *_) -> str | None:
        if value is not None:
            decrypted_value = self.fernet.decrypt(token=value)
            return force_str(s=decrypted_value)
