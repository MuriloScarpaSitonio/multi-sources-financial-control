from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Self

from aiohttp import ClientSession, ClientTimeout, TCPConnector

if TYPE_CHECKING:
    from authentication.models import IntegrationSecret


class AbstractTransactionsClient(ABC):
    def __init__(self, secrets: IntegrationSecret, timeout: int = 30) -> None:
        self._secrets = secrets
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
        )
        self._session.headers.update(self._get_headers())

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    def _get_headers(self):  # pragma: no cover
        return {}

    @abstractmethod
    async def fetch_transactions(self, **kw) -> list[dict[str, Any]]:
        ...
