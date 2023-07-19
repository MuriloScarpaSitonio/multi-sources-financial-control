from decimal import Decimal

from fastapi import FastAPI, status

from .clients import AwesomeApiClient
from .schemas import NotFoundResponse

app = FastAPI()


@app.get(
    "/convert_currency",
    responses={
        status.HTTP_200_OK: {
            "content": {"application/json": {"example": Decimal("6")}},
        },
        status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse},
    },
)
async def convert_currencies(from_: str, to: str) -> Decimal:
    async with AwesomeApiClient() as client:
        return Decimal(await client.convert_currencies(from_=from_, to=to))
