import asyncio
from hashlib import sha256
from hmac import new as hmac_new
from time import time
from urllib.parse import urlencode

from aiohttp import ClientResponse

from ...choices import Currencies
from ..clients.abc import AbstractTransactionsClient
from .enums import FiatPaymentTransactionType, TransactionType
from .types import (
    AccountSnapshotResponse,
    FiatPayment,
    FiatPaymentsResponse,
    SymbolOrder,
    SymbolOrderResponse,
)


class BinanceClient(AbstractTransactionsClient):
    API_VERSION = 3
    API_MARGIN_VERSION = 1
    API_URL = "https://api{}.binance.com"

    def _get_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-MBX-APIKEY": self._secrets.binance_api_key,
            "KC-API-PASSPHRASE": self._secrets.kucoin_api_passphrase,
            "timeout": str(self._session.timeout.total),
        }

    async def __aenter__(self) -> "BinanceClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    @staticmethod
    def _create_path(path: str, api_version: int, is_margin_api: bool) -> str:
        api = "sapi" if is_margin_api else "api"
        return f"{api}/v{api_version}/{path}"

    @classmethod
    def _create_url(cls, path: str, is_margin_api: bool) -> str:
        api_version = cls.API_MARGIN_VERSION if is_margin_api else cls.API_VERSION
        return "{}/{}".format(
            cls.API_URL.format(api_version),
            cls._create_path(path=path, api_version=api_version, is_margin_api=is_margin_api),
        )

    def _generate_signature(self, params: dict[str, str]) -> str:
        return hmac_new(
            self._secrets.binance_api_secret.encode("utf-8"),
            (urlencode(params)).encode("utf-8"),
            sha256,
        ).hexdigest()

    async def _get(
        self,
        path: str,
        params: dict[str, str] | None = None,
        is_margin_api: bool = False,
        signed: bool = False,
    ) -> ClientResponse:
        params = params if params is not None else {}
        if signed:
            # generate signature
            params["timestamp"] = int(time() * 1000)
            params["signature"] = self._generate_signature(params)

        response = await self._session.get(
            url=self._create_url(path=path, is_margin_api=is_margin_api),
            params=params,
        )

        response.raise_for_status()
        return response

    async def _get_symbol_trade_orders(
        self, symbol: str, start_timestamp: int = 0
    ) -> list[SymbolOrderResponse]:
        response = await self._get(
            path="allOrders",
            params={"symbol": symbol, "startTime": start_timestamp, "limit": 1000},
            signed=True,
        )
        result = await response.json()
        return result

    async def _get_all_filled_trade_orders(
        self, account_type: str, start_timestamp: int
    ) -> list[SymbolOrder]:
        # 1. get all assets in user's acount
        response = await self._get(
            path="accountSnapshot",
            is_margin_api=True,
            signed=True,
            params={"type": account_type},
        )
        result: AccountSnapshotResponse = await response.json()

        # 2. fetch the orders for every asset
        tasks = [
            self._get_symbol_trade_orders(
                symbol="{}{}".format(infos["asset"], Currencies.real),
                start_timestamp=start_timestamp,
            )
            for infos in result["snapshotVos"][0]["data"]["balances"]
            if infos["asset"] != Currencies.real
            and not infos["asset"].startswith(Currencies.dollar)
        ]
        return [
            {**order, "type_": TransactionType.TRADE}
            for result in await asyncio.gather(*tasks, return_exceptions=True)
            if not isinstance(result, Exception)
            for order in result
            if order["status"] == "FILLED"
        ]

    async def _get_fiat_payments_order(
        self, transaction_type: FiatPaymentTransactionType, start_timestamp: int = 0
    ) -> list[FiatPayment]:
        response = await self._get(
            path="fiat/payments",
            is_margin_api=True,
            signed=True,
            params={"transactionType": transaction_type, "beginTime": start_timestamp, "rows": 500},
        )
        result: FiatPaymentsResponse = await response.json()
        return [
            {**r, "side": transaction_type.name, "type_": TransactionType.FIAT}
            for r in result.get("data", [])
            if r["status"] == "Completed"
        ]

    async def fetch_transactions(
        self, account_type: str = "SPOT", include_fiat: bool = True, start_timestamp: int = 0
    ) -> list[FiatPayment | SymbolOrder]:
        tasks = [
            self._get_all_filled_trade_orders(
                account_type=account_type, start_timestamp=start_timestamp
            )
        ]
        if include_fiat:
            tasks.extend(
                (
                    self._get_fiat_payments_order(
                        transaction_type=FiatPaymentTransactionType.BUY,
                        start_timestamp=start_timestamp,
                    ),
                    self._get_fiat_payments_order(
                        transaction_type=FiatPaymentTransactionType.SELL,
                        start_timestamp=start_timestamp,
                    ),
                )
            )
        return [
            order
            for result in await asyncio.gather(*tasks, return_exceptions=True)
            if not isinstance(result, Exception)
            for order in result
        ]
