from typing import Dict, List, Optional

from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector

from ..settings import TWELVE_DATA_API_KEY


class TwelveDataClient:
    API_URL = "https://api.twelvedata.com/{path}?apikey={api_key}"

    def __init__(self, timeout: int = 30) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
        )

    async def __aenter__(self) -> "TwelveDataClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _create_url(self, path: str, api_key: str = TWELVE_DATA_API_KEY) -> str:
        return self.API_URL.format(path=path, api_key=api_key)

    async def _get(self, path: str, params: Optional[Dict[str, str]] = None) -> ClientResponse:
        response = await self._session.get(
            url=await self._create_url(path=path), params=params if params is not None else {}
        )
        response.raise_for_status()
        return response

    async def get_prices(self, codes: List[str]) -> Dict[str, str]:
        response = await self._get(path="price", params={"symbol": ",".join(codes)})
        result = await response.json()
        return (
            {codes[0]: result["price"]}
            if len(result) == 1
            else {k: v["price"] for k, v in result.items()}
        )
