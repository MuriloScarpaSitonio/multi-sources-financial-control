from django.conf import settings

from aiohttp import ClientSession, ClientTimeout, TCPConnector


class ApyHubClient:
    API_URL = "https://api.apyhub.com"

    def __init__(self, timeout: int = 300, api_key: str = "") -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(ssl=False, force_close=True),
            base_url="https://api.apyhub.com",
            headers={"apy-token": api_key or settings.APY_HUB_API_KEY},
        )

    async def __aenter__(self) -> "ApyHubClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def convert_currencies(self, source: str, target: str) -> str:
        response = await self._session.post(
            url="/data/convert/currency", json={"source": source, "target": target}
        )
        response.raise_for_status()
        result = await response.json()
        return result["data"]
