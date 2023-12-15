from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings

from aiohttp import ClientSession, ClientTimeout, TCPConnector

if TYPE_CHECKING:
    from collections.abc import Iterable


class CoinMarketCapClient:
    def __init__(self, timeout: int = 300, api_key: str = "") -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(ssl=False, force_close=True),
            base_url="https://pro-api.coinmarketcap.com",
            headers={"X-CMC_PRO_API_KEY": api_key or settings.COIN_MARKET_CAP_API_KEY},
        )

    async def __aenter__(self) -> CoinMarketCapClient:
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def get_prices(self, symbols: Iterable[str], currency: str) -> dict[str, float]:
        if not symbols:
            return {}
        response = await self._session.get(
            f"/v2/cryptocurrency/quotes/latest?symbol={','.join(symbols)}",
            params={"convert": currency},
        )
        response.raise_for_status()
        result = await response.json()
        return {
            symbol: data[0]["quote"][currency]["price"] for symbol, data in result["data"].items()
        }
