import pickle  # nosec
from threading import Lock, RLock
from time import monotonic
from typing import Any, TypedDict

from django.conf import settings

from redis import Redis

# region: types


class _Cache(TypedDict):
    expire: float
    value: Any


# endregion: types


# https://github.com/jazzband/django-constance/blob/master/constance/backends/redisd.py
class RedisBackend:
    def __init__(self, url: str = "", timeout: int | None = None) -> None:
        self._client = Redis.from_url(url or settings.REDIS_CONNECTION_URL)
        self.timeout = timeout if timeout is not None else settings.REDIS_TIMEOUT_IN_SECONDS

    def ping(self) -> bool:  # pragma: no cover
        return self._client.ping()

    def get(self, key: str) -> Any:
        value = self._client.get(key)
        return pickle.loads(value) if value else value  # nosec

    def set(self, key: str, value: Any) -> None:
        self._client.set(key, pickle.dumps(value), ex=self.timeout)


class RedisBackendWInMemoryCache(RedisBackend):
    _default = object()
    _lock = RLock()

    def __init__(self, url: str = "", timeout: int | None = None) -> None:
        super().__init__(url=url, timeout=timeout)
        self._cache: dict[str, _Cache] = {}

    def _set_memory_cache(self, key: str, value: Any) -> None:
        self._cache[key] = {"expire": monotonic() + self.timeout, "value": value}

    def get(self, key: str) -> Any:
        cache: object | _Cache = self._cache.get(key, self._default)
        if cache is self._default or cache["expire"] <= monotonic():
            with self._lock:
                value = super().get(key)
                # Ideally, this update would have been done by `set` method below
                # but it may happen that the value is indeed the same between two
                # updates (two `set` call). In this scenario, we'd like to still
                # avoid calling redis so we update the memory cache to adjust the
                # `expire` for this given `key`
                if value is not None:
                    self._set_memory_cache(key, value)
                return value

        return cache["value"]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            super().set(key, value)
            self._set_memory_cache(key, value)


# https://github.com/jazzband/django-constance/blob/master/constance/backends/memory.py
class MemoryBackend:
    _storage = {}
    _lock = Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            return self._storage.get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._storage[key] = value


if settings.ENVIRONMENT == "pytest":
    key_value_backend = MemoryBackend()
else:  # pragma: no cover
    try:
        key_value_backend = RedisBackendWInMemoryCache()
        key_value_backend.ping()
    except Exception as e:
        print(e)
        key_value_backend = MemoryBackend()
