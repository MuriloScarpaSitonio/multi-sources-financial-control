from __future__ import annotations

import asyncio
from decimal import Decimal
from typing import TYPE_CHECKING

from django.conf import settings

from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector

if TYPE_CHECKING:
    from datetime import date


class TwelveDataClient:
    API_URL = "https://api.twelvedata.com/{path}?apikey={api_key}"

    def __init__(self, timeout: int = 300) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(ssl=False, force_close=True),
        )

    async def __aenter__(self) -> TwelveDataClient:
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _create_url(self, path: str, api_key: str | None = None) -> str:
        return self.API_URL.format(
            path=path, api_key=api_key if api_key is not None else settings.TWELVE_DATA_API_KEY
        )

    async def _get(self, path: str, params: dict[str, str] | None = None) -> ClientResponse:
        response = await self._session.get(
            url=await self._create_url(path=path), params=params if params is not None else {}
        )
        response.raise_for_status()
        return response

    async def get_prices(self, codes: list[str]) -> dict[str, str]:
        if not codes:
            return {}

        # TwelveData API has a limit of 8 symbols per minute
        # TODO: handle this by splitting the list into chunks of 8 symbols and
        # making requests with a one minute delay between chunks
        if len(codes) > 8:
            codes = codes[:8]
        response = await self._get(path="price", params={"symbol": ",".join(codes)})
        result = await response.json()
        return (
            {codes[0]: result["price"]}
            if len(result) == 1
            else {k: v["price"] for k, v in result.items()}
        )

    async def get_close_prices(
        self, symbols: list[str], operation_date: date
    ) -> dict[str, Decimal]:
        if not symbols:
            return {}

        async def _get(symbol):
            """
            {
                "symbol": "AAPL",
                "exchange": "NASDAQ",
                "mic_code": "XNAS",
                "currency": "USD",
                "datetime": "2021-09-16",
                "close": "148.79"
            }
            """
            response = await self._get(
                path="eod",
                params={"symbol": symbol, "date": operation_date.isoformat()},
            )
            response.raise_for_status()
            return await response.json()

        tasks = asyncio.gather(*(_get(symbol) for symbol in symbols), return_exceptions=True)

        return {
            symbols[idx]: Decimal(result["close"])  # order is guaranteed
            for idx, result in await enumerate(tasks)
            if not isinstance(result, Exception)
        }
