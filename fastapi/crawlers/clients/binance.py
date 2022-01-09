import asyncio
from datetime import datetime, timedelta
from hashlib import sha256
from hmac import new as hmac_new
from time import time
from typing import Dict, List, Optional

from aiohttp import ClientSession, ClientTimeout, TCPConnector, ClientResponse
from aiohttp.client_exceptions import ClientError

from ..constants import DEFAULT_BINANCE_CURRENCY
from ..schemas import AssetFetchCurrentPriceFilterSet
from ..database.models import User
from ..database.utils import decrypt


class BinanceClient:
    API_VERSION = 3
    API_MARGIN_VERSION = 1
    API_URL = "https://api{}.binance.com"

    class BinanceClientException(Exception):
        pass

    def __init__(self, user: User, timeout: int = 30) -> None:
        self._api_secret_key = decrypt(user.secrets.binance_api_secret)
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "timeout": str(timeout),
                "X-MBX-APIKEY": decrypt(user.secrets.binance_api_key),
            },
        )

    async def __aenter__(self) -> "BinanceClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _create_path(self, path: str, api_version: int, is_margin_api: bool) -> str:
        api = "sapi" if is_margin_api else "api"
        return f"{api}/v{api_version}/{path}"

    async def _create_url(self, path: str, api_version: int, is_margin_api: bool) -> str:
        return "{}/{}".format(
            self.API_URL.format(api_version),
            await self._create_path(
                path=path, api_version=api_version, is_margin_api=is_margin_api
            ),
        )

    async def _generate_signature(self, params: Dict[str, str]) -> str:
        from urllib.parse import urlencode

        return hmac_new(
            self._api_secret_key.encode("utf-8"), (urlencode(params)).encode("utf-8"), sha256
        ).hexdigest()

    async def _get(
        self,
        path: str,
        params: Optional[Dict[str, str]] = None,
        is_margin_api: bool = False,
        signed: bool = False,
    ) -> ClientResponse:
        api_version = self.API_MARGIN_VERSION if is_margin_api else self.API_VERSION
        params = params if params is not None else {}
        if signed:
            # generate signature
            params["timestamp"] = int(time() * 1000)
            params["signature"] = await self._generate_signature(params)

        response = await self._session.get(
            url=await self._create_url(
                path=path,
                api_version=api_version,
                is_margin_api=is_margin_api,
            ),
            params=params,
        )

        response.raise_for_status()
        return response

    async def _get_price(self, code: str) -> str:
        response = await self._get(path="ticker/price", params={"symbol": code})
        result = await response.json()
        return result["price"]

    async def get_prices(
        self,
        assets: Optional[List[AssetFetchCurrentPriceFilterSet]] = None,
        codes: Optional[List[str]] = None,
    ) -> Dict[str, str]:
        if not assets and not codes:
            raise self.BinanceClientException("One of the `assets` or `codes` kwargs is required.")

        if assets:
            tasks = [
                self._get_price(code="{}{}".format(asset.code, asset.currency)) for asset in assets
            ]
            return {
                asset.code: price
                for asset, price in zip(
                    assets, await asyncio.gather(*tasks, return_exceptions=True)
                )
                if not isinstance(price, ClientError)
            }
        if codes:
            tasks = [self._get_price(code=code) for code in codes]
            return {
                code: price
                for code, price in zip(codes, await asyncio.gather(*tasks, return_exceptions=True))
                if not isinstance(price, ClientError)
            }

    async def _get_symbol_orders(self, symbol: str, start_timestamp: Optional[int] = None):
        response = await self._get(
            path="allOrders",
            params={
                "symbol": symbol,
                "startTime": int((datetime.now() - timedelta(days=2)).timestamp()) * 1000,
            },
            signed=True,
        )
        result = await response.json()
        return result

    async def get_orders(self, account_type: str = "SPOT", start_timestamp: Optional[int] = None):
        response = await self._get(
            path="accountSnapshot",
            is_margin_api=True,
            signed=True,
            params={"type": account_type},
        )
        result = await response.json()
        tasks = [
            self._get_symbol_orders(
                symbol="{}{}".format(infos["asset"], DEFAULT_BINANCE_CURRENCY),
                start_timestamp=start_timestamp,
            )
            for infos in result["snapshotVos"][0]["data"]["balances"]
            if infos["asset"] != DEFAULT_BINANCE_CURRENCY
        ]
        return [
            order
            for result in await asyncio.gather(*tasks)
            for order in result
            if order["status"] == "FILLED"
        ]
