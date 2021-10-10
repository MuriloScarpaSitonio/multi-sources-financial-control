from typing import Any, Union

from cryptography.fernet import Fernet

from django.conf import settings
from django.db import models
from django.utils import encoding
from django.utils.encoding import force_bytes, force_str
from django.utils.functional import cached_property
from django.db.backends.base.base import BaseDatabaseWrapper


class EncryptedField(models.CharField):
    description = "Save encrypted data to DB an read as string on application level."

    def __init__(self, *args, **kwargs):
        kwargs["max_length"] = 1000
        super().__init__(*args, **kwargs)

    @cached_property
    def fernet(self) -> Fernet:
        return Fernet(key=settings.FERNET_KEY)

    def get_internal_type(self) -> str:
        return "BinaryField"

    def get_db_prep_save(
        self, value: Any, connection: BaseDatabaseWrapper
    ) -> Union[memoryview, None]:
        value = super().get_db_prep_save(value, connection)
        if value is not None:
            encrypted_value = self.fernet.encrypt(data=force_bytes(s=value))
            return connection.Database.Binary(encrypted_value)

    def from_db_value(self, value: bytes, *args) -> Union[str, None]:
        if value is not None:
            decrypted_value = self.fernet.decrypt(token=value)
            return force_str(s=decrypted_value)
