from __future__ import annotations

import asyncio
from base64 import b64encode
from datetime import timedelta
from decimal import Decimal
from hashlib import sha256
from hmac import new as hmac_new
from time import mktime, time
from typing import TYPE_CHECKING, TypedDict
from urllib.parse import urlencode

from aiohttp import ClientResponse

from ..clients.abc import AbstractTransactionsClient

if TYPE_CHECKING:
    from datetime import date

# region: types


class _KuCoinTransaction(TypedDict):
    id: str  # "5c35c02703aa673ceec2a168" ->  orderid
    symbol: str  # "BTC-USDT" ->  symbol
    opType: str  # "DEAL" ->  operation type: DEAL
    type: str  # "limit" ->  order type,e.g. limit,market,stop_limit.
    side: str  # "buy" ->  transaction direction,include buy and sell
    price: str  # "10" ->  order price
    size: str  # "2" ->  order quantity
    funds: str  # "0" ->  order funds
    dealFunds: str  # "0.166" ->  deal funds
    dealSize: str  # "2" ->  deal quantity
    fee: str  # "0" ->  fee
    feeCurrency: str  # "USDT" ->  charge fee currency
    stp: str  # "" ->  self trade prevention,include CN,CO,DC,CB
    stop: str  # "" ->  stop type
    stopTriggered: bool  # False ->  stop order is triggered
    stopPrice: str  # "0" ->  stop price
    timeInForce: str  # "GTC" ->  time InForce,include GTC,GTT,IOC,FOK
    postOnly: bool  # False ->  postOnly
    hidden: bool  # False ->  hidden order
    iceberg: bool  # False ->  iceberg order
    visibleSize: str  # "0" ->  display quantity for iceberg order
    cancelAfter: int  # 0 ->  cancel orders time，requires timeInForce to be GTT
    channel: str  # "IOS" ->  order source
    clientOid: str  # "" ->  user-entered order unique mark
    remark: str  # "" ->  remark
    tags: str  # "" ->  tag order source
    isActive: bool  # False ->  status before unfilled or uncancelled
    cancelExist: bool  # False ->  order cancellation transaction record
    createdAt: float  # 1547026471000.0 ->  create time
    tradeType: str  # "TRADE",


# endregion: types


class KuCoinClient(AbstractTransactionsClient):
    API_URL = "https://openapi-v2.kucoin.com"
    API_VERSION = "v1"

    def _get_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "python-kucoin",
            "Content-Type": "application/json",
            "KC-API-KEY": self._secrets.kucoin_api_key,
            "KC-API-PASSPHRASE": self._secrets.kucoin_api_passphrase,
            "timeout": str(self._session.timeout.total),
        }

    def _generate_signature(
        self,
        timestamp: int,
        path: str,
        params: dict[str, str],
        method: str = "get",
    ) -> str:
        path = f"{path}?{urlencode(params)}" if params else path
        sig_str = (f"{timestamp}{method.upper()}{path}").encode()
        m = hmac_new(self._secrets.kucoin_api_secret.encode("utf-8"), sig_str, sha256)
        return str(b64encode(m.digest()), "utf-8")

    def _create_path(self, path: str, api_version: str | None = None) -> str:
        api_version = api_version if api_version is not None else self.API_VERSION
        return f"/api/{api_version}/{path}"

    def _create_url(self, path: str) -> str:
        return f"{self.API_URL}{path}"

    async def _get(self, path: str, params: dict[str, str] | None = None) -> ClientResponse:
        params = params if params is not None else {}
        full_path = self._create_path(path)

        timestamp = int(time() * 1000)
        headers = {
            "KC-API-TIMESTAMP": str(timestamp),
            "KC-API-SIGN": self._generate_signature(
                timestamp=timestamp, path=full_path, params=params
            ),
        }
        response = await self._session.get(
            url=self._create_url(full_path), params=params, headers=headers
        )
        response.raise_for_status()
        return response

    async def fetch_transactions(self, trade_type: str = "TRADE") -> list[_KuCoinTransaction]:
        # NOTE: we only retrieve the first page of orders (500 at max)
        response = await self._get(path="orders", params={"tradeType": trade_type, "pageSize": 500})
        result = await response.json()
        return result["data"]["items"]

    async def get_close_prices(
        self, symbols: list[str], operation_date: date
    ) -> dict[str, Decimal]:
        if not symbols:
            return

        start_time = mktime(operation_date.timetuple())
        end_time = mktime((operation_date + timedelta(days=1)).timetuple())

        async def _get(symbol):
            """
            [
                [
                    "1545904980", //Start time of the candle cycle
                    "0.058", //opening price
                    "0.049", //closing price
                    "0.058", //highest price
                    "0.049", //lowest price
                    "0.018", //Transaction volume
                    "0.000945" //Transaction amount
                ],
            ]
            """
            response = await self._get(
                path="klines",
                params={
                    "symbol": symbol,
                    "type": "1day",
                    "startAt": start_time,
                    "endAt": end_time,
                },
            )
            response.raise_for_status()
            return await response.json()

        tasks = asyncio.gather(*(_get(symbol) for symbol in symbols), return_exceptions=True)

        return {
            symbols[idx]: Decimal(result[0][2])  # order is guaranteed
            for idx, result in await enumerate(tasks)
            if not isinstance(result, Exception)
        }
