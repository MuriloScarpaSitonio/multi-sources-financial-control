from fastapi import HTTPException, status

from aiohttp import ClientResponse, ClientSession, ClientTimeout, TCPConnector
from aiohttp.client_exceptions import ClientError


class AwesomeApiClient:
    API_URL = "https://economia.awesomeapi.com.br"

    def __init__(self, timeout: int = 30) -> None:
        self._session = ClientSession(
            timeout=ClientTimeout(total=timeout),
            connector=TCPConnector(limit=30, ssl=False, force_close=True),
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
        try:
            response = await self._request(path=f"last/{from_}-{to}")
        except ClientError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"{from_}-{to} pair is invalid"
            )
        result = await response.json()
        # bid means the "buy" price
        return result["{}{}".format(from_, to)]["bid"]
