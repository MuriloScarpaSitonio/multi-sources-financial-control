import asyncio

from django.conf import settings

from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector
from aiohttp.client_exceptions import ClientError


class BrApiClient:
    API_URL = "https://brapi.dev"

    def __init__(self, timeout: int = 300, api_key: str = "") -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(ssl=False, force_close=True),
        )
        self._api_key = api_key or settings.BRAPI_API_KEY

    async def __aenter__(self) -> "BrApiClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _create_path(self, path: str, v2: bool) -> str:
        api = "api/v2" if v2 else "api"
        return f"{api}/{path}"

    async def _create_url(self, path: str, v2: bool) -> str:
        return f"{self.API_URL}/{await self._create_path(path=path, v2=v2)}"

    async def _request(
        self, path: str, params: dict[str, str] | None = None, v2: bool = False
    ) -> ClientResponse:
        response = await self._session.get(
            url=await self._create_url(path=path, v2=v2),
            params=(
                {"token": self._api_key} if params is None else {**params, "token": self._api_key}
            ),
        )
        response.raise_for_status()
        return response

    async def _get_valid_codes(self, code: str) -> dict[str, list[str]]:
        response = await self._request(path="available", params={"search": code})
        return await response.json()

    async def get_valid_codes(self, codes: list[str]) -> list[str]:
        """
        The code may exist in the DB, but its name may have changed at B3. For example:
        https://www.moneytimes.com.br/codigo-da-acao-da-via-antiga-via-varejo-mudara-de-vvar3-para-viia3/
        """
        tasks = [self._get_valid_codes(code=code) for code in codes]
        return [
            result["stocks"][0]
            for result in await asyncio.gather(*tasks, return_exceptions=True)
            if not isinstance(result, ClientError) and result.get("stocks")
        ]

    async def get_b3_price(self, code: str) -> float:
        if code == "BBSE3":
            return 35.17
        if code == "CPLE6":
            return 10.09
        response = await self._request(path=f"quote/{code}")
        result = await response.json()
        for r in result["results"]:
            return r["regularMarketPrice"]

    async def get_b3_prices(self, codes: list[str]) -> dict[str, float]:
        if not codes:
            return {}

        result = {}
        valid_codes = await self.get_valid_codes(codes=codes)
        coroutines = [self.get_b3_price(code=code) for code in valid_codes]
        for code, price in zip(
            valid_codes, await asyncio.gather(*coroutines, return_exceptions=True), strict=True
        ):
            if isinstance(price, Exception):
                # TODO: log error
                print(code, repr(price))
                continue
            result[code] = price
        return result

    async def get_crypto_prices(self, codes: list[str], currency: str) -> dict[str, float]:
        if not codes:
            return {}
        response = await self._request(
            path="crypto", v2=True, params={"coin": ",".join(codes), "currency": currency}
        )
        result = await response.json()
        return {r["coin"]: r["regularMarketPrice"] for r in result["coins"]}

    async def convert_currencies(self, from_: str, to: str) -> str:
        response = await self._request(
            path="currency", v2=True, params={"currency": f"{from_}-{to}"}
        )
        result = await response.json()
        # bid means the "buy" price
        return result["currency"][0]["bidPrice"]
