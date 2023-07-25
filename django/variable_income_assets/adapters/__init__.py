from django.conf import settings

from .key_value_store import MemoryBackend, RedisBackendWInMemoryCache
from .sql import (
    AssetRepository,
    DjangoSQLAssetMetaDataRepository,
    PassiveIncomeRepository,
    TransactionRepository,
)

if settings.ENVIRONMENT == "pytest":
    key_value_backend = MemoryBackend()
else:  # pragma: no cover
    key_value_backend = RedisBackendWInMemoryCache()
