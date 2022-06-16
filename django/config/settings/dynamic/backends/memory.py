from threading import Lock
from typing import Any


class MemoryBackend:
    _storage = {}
    _lock = Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            return self._storage.get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._storage[key] = value
