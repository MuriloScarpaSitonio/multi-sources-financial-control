from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector


class AwesomeApiClient:
    API_URL = "https://economia.awesomeapi.com.br/json"

    def __init__(self, timeout: int = 300) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(ssl=False, force_close=True),
        )

    async def __aenter__(self) -> "AwesomeApiClient":
        return self

    async def __aexit__(self, *_, **__) -> None:
        await self._session.close()

    async def _request(self, path: str) -> ClientResponse:
        response = await self._session.get(url=f"{self.API_URL}/{path}")
        response.raise_for_status()
        return response

    async def convert_currencies(self, from_: str, to: str) -> str:
        response = await self._request(path=f"last/{from_}-{to}")
        result = await response.json()
        # bid means the "buy" price
        return result[f"{from_}{to}"]["bid"]
