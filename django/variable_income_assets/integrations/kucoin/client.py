from base64 import b64encode
from hashlib import sha256
from hmac import new as hmac_new
from time import time
from typing import TypedDict
from urllib.parse import urlencode

from aiohttp import ClientResponse

from ..clients.abc import AbstractTransactionsClient

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
