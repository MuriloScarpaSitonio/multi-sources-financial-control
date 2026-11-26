from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import quote
from zoneinfo import ZoneInfo

from aiohttp import ClientError, ClientSession, ClientTimeout

logger = logging.getLogger(__name__)


class YahooFinanceClient:
    def __init__(self, timeout: int = 30) -> None:
        self._session = ClientSession(
            base_url="https://query1.finance.yahoo.com",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=ClientTimeout(total=timeout),
        )

    async def __aenter__(self) -> YahooFinanceClient:
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def get_prices(self, codes: Iterable[str]) -> dict[str, str]:
        prices = await self._fetch_prices(codes)
        return {code: str(price) for code, price in prices.items()}

    async def get_close_prices(
        self, symbols: Iterable[str], operation_date: date
    ) -> dict[str, Decimal]:
        return await self._fetch_prices(symbols, operation_date)

    @staticmethod
    def _daily_close(chart: dict, operation_date: date) -> Decimal | None:
        timezone = ZoneInfo(chart["meta"]["exchangeTimezoneName"])
        closes = chart["indicators"]["quote"][0]["close"]
        for timestamp, close in zip(chart["timestamp"], closes, strict=True):
            if (
                close is not None
                and datetime.fromtimestamp(timestamp, timezone).date() == operation_date
            ):
                # Yahoo daily bars contain floating-point artifacts beyond the quoted precision.
                return round(Decimal(str(close)), chart["meta"]["priceHint"])
        return None

    async def _fetch_prices(
        self, codes: Iterable[str], operation_date: date | None = None
    ) -> dict[str, Decimal]:
        params = {"interval": "1d", "range": "1d"}
        if operation_date is not None:
            # Include neighboring UTC dates, then match the requested date in exchange local time.
            midnight = datetime.combine(operation_date, time.min, tzinfo=UTC)
            params = {
                "interval": "1d",
                "period1": str(int((midnight - timedelta(days=1)).timestamp())),
                "period2": str(int((midnight + timedelta(days=2)).timestamp())),
            }

        prices = {}
        for code in dict.fromkeys(codes):
            symbol = "VWRA.L" if code == "VWRA" else code
            url = f"/v8/finance/chart/{quote(symbol, safe='')}"
            try:
                async with self._session.get(url, params=params) as response:
                    response.raise_for_status()
                    payload = await response.json()
                chart = payload["chart"]["result"][0]
                meta = chart["meta"]
                if meta["symbol"] != symbol or meta["currency"] != "USD":
                    raise ValueError("Unexpected symbol or currency")
                if code == "VWRA" and meta["exchangeName"] != "LSE":
                    raise ValueError("Expected the London listing for VWRA")
                value = (
                    meta["regularMarketPrice"]
                    if operation_date is None
                    else self._daily_close(chart, operation_date)
                )
                if value is None:
                    raise ValueError("Price unavailable for requested date")
                price = Decimal(str(value))
                if not price.is_finite() or price <= 0:
                    raise ValueError("Invalid market price")
                prices[code] = price
            except (
                ClientError,
                TimeoutError,
                KeyError,
                IndexError,
                TypeError,
                ValueError,
                InvalidOperation,
            ) as exc:
                logger.warning("Yahoo Finance price lookup failed for %s: %s", code, exc)
        return prices
