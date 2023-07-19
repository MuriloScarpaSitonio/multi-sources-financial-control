from __future__ import annotations

from typing import TYPE_CHECKING, Self
from urllib.parse import urljoin

from aiohttp import ClientSession, ClientTimeout, TCPConnector

from django.conf import settings

if TYPE_CHECKING:
    from aiohttp import ClientResponse


class QStashClient:
    API_BASE_URL = "https://qstash.upstash.io/v1"

    def __init__(self, timeout: int = 30) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
            headers={"Authorization": f"Bearer {settings.QSTASH_TOKEN}"},
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    def _create_url(self, path: str, target_url: str) -> str:
        return urljoin(self.API_BASE_URL, path) + target_url

    async def publish(self, target_url: str, data: dict | list) -> ClientResponse:
        url = self._create_url(path="publish/", target_url=target_url)
        return await self._session.post(url, json=data)
