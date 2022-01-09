import asyncio
from typing import Dict, List, Optional

from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector
from aiohttp.client_exceptions import ClientError


class BrApiClient:
    API_URL = "https://brapi.ga"

    def __init__(self, timeout: int = 30) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
        )

    async def __aenter__(self) -> "BrApiClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _create_path(self, path: str, is_crypto: bool) -> str:
        api = "api/v2/crypto" if is_crypto else "api"
        return f"{api}/{path}"

    async def _create_url(self, path: str, is_crypto: bool) -> str:
        return f"{self.API_URL}/{await self._create_path(path=path, is_crypto=is_crypto)}"

    async def _request(
        self, path: str, params: Optional[Dict[str, str]] = None, is_crypto: bool = False
    ) -> ClientResponse:
        response = await self._session.get(
            url=await self._create_url(path=path, is_crypto=is_crypto), params=params
        )
        response.raise_for_status()
        return response

    async def _get_valid_codes(self, code: str) -> Dict[str, List[str]]:
        response = await self._request(path="available", params={"search": code})
        return await response.json()

    async def get_valid_codes(self, codes: List[str]) -> List[str]:
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

    async def get_b3_prices(self, codes: List[str]) -> Dict[str, float]:
        valid_codes = await self.get_valid_codes(codes=codes)
        response = await self._request(path=f"quote/{','.join(valid_codes)}")
        result = await response.json()
        return {r["symbol"]: r["regularMarketPrice"] for r in result["results"]}

    async def get_crypto_prices(self, codes: List[str], currency: str) -> Dict[str, float]:
        response = await self._request(
            path="", is_crypto=True, params={"coin": ",".join(codes), "currency": currency}
        )
        result = await response.json()
        return {r["coin"]: r["regularMarketPrice"] for r in result["coins"]}
