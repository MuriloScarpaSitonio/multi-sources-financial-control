from time import time
from base64 import b64encode
from hashlib import sha256
from hmac import new as hmac_new
from urllib.parse import urlencode

from aiohttp import ClientSession, ClientTimeout, TCPConnector, ClientResponse

from authentication.models import IntegrationSecret


class KuCoinClient:
    API_URL = "https://openapi-v2.kucoin.com"
    API_VERSION = "v1"

    def __init__(self, secrets: IntegrationSecret, timeout: int = 30) -> None:
        self._api_secret_key = secrets.kucoin_api_secret
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
            headers={
                "Accept": "application/json",
                "User-Agent": "python-kucoin",
                "Content-Type": "application/json",
                "KC-API-KEY": secrets.kucoin_api_key,
                "KC-API-PASSPHRASE": secrets.kucoin_api_passphrase,
                "timeout": str(timeout),
            },
        )

    async def __aenter__(self) -> "KuCoinClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    @property
    def api_secret(self) -> bytes:
        return self._api_secret_key.encode("utf-8")

    async def _generate_signature(
        self,
        timestamp: int,
        path: str,
        params: dict[str, str],
        method: str = "get",
    ) -> str:
        path = f"{path}?{urlencode(params)}" if params else path
        sig_str = ("{}{}{}".format(timestamp, method.upper(), path)).encode("utf-8")
        m = hmac_new(self.api_secret, sig_str, sha256)
        return str(b64encode(m.digest()), "utf-8")

    async def _create_path(self, path: str, api_version: str | None = None) -> str:
        api_version = api_version if api_version is not None else self.API_VERSION
        return f"/api/{api_version}/{path}"

    async def _create_url(self, path: str) -> str:
        return "{}{}".format(self.API_URL, path)

    async def _get(self, path: str, params: dict[str, str] | None = None) -> ClientResponse:
        params = params if params is not None else dict()
        full_path = await self._create_path(path)

        timestamp = int(time() * 1000)
        headers = {
            "KC-API-TIMESTAMP": str(timestamp),
            "KC-API-SIGN": await self._generate_signature(
                timestamp=timestamp, path=full_path, params=params
            ),
        }
        response = await self._session.get(
            url=await self._create_url(full_path), params=params, headers=headers
        )
        response.raise_for_status()
        return response

    async def get_orders(self, trade_type: str = "TRADE") -> list[dict[str, str | float]]:
        # NOTE: we only retrieve the first page of orders (50 at total)
        response = await self._get(path="orders", params={"tradeType": trade_type})
        result = await response.json()
        return result["data"]["items"]

    async def get_prices(self, codes: list[str]) -> dict[str, str]:
        if not codes:
            return {}
        response = await self._get(path="prices", params={"currencies": ",".join(codes)})
        result = await response.json()
        return result["data"]
