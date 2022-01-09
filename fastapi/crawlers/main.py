import asyncio
from datetime import date as date_typing, datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import Depends, FastAPI, Query, status

from sqlmodel import Session, SQLModel

from .clients import AwesomeApiClient, BinanceClient, BrApiClient, CeiCrawler, KuCoinClient
from .constants import AssetTypes
from .database import engine
from .schemas import (
    AssetCurrentPrice,
    AssetFetchCurrentPriceFilterSet,
    CeiTransaction,
    BianceOrder,
    KuCoinOrder,
    NotFoundResponse,
    PassiveIncome,
)
from .database.crud import get_user

app = FastAPI()


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


def get_db() -> Session:
    with Session(engine) as session:
        yield session


@app.get(
    path="/cei/transactions",
    response_model=List[CeiTransaction],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def fetch_cei_transactions(
    username: str,
    start_date: Optional[date_typing] = None,
    end_date: Optional[date_typing] = None,
    db: Session = Depends(get_db),
):
    user = await get_user(username=username, db=db)
    async with CeiCrawler(user=user) as crawler:
        return await crawler.get_assets(start_date=start_date, end_date=end_date)


@app.get(
    path="/cei/passive_incomes",
    response_model=List[PassiveIncome],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def fetch_passive_incomes(
    username: str, date: Optional[date_typing] = None, db: Session = Depends(get_db)
):
    user = await get_user(username=username, db=db)
    async with CeiCrawler(user=user) as crawler:
        return await crawler.get_passive_incomes(date=date)


@app.get(
    path="/kucoin/transactions",
    response_model=List[KuCoinOrder],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def fetch_kucoin_transactions(username: str, db: Session = Depends(get_db)):
    user = await get_user(username=username, db=db)
    async with KuCoinClient(user=user) as client:
        return await client.get_orders()


@app.get(
    path="/kucoin/prices",
    response_model=AssetCurrentPrice,
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
    deprecated=True,
)
async def fetch_kucoin_prices(
    username: str, codes: List[str] = Query(...), db: Session = Depends(get_db)
):
    user = await get_user(username=username, db=db)
    async with KuCoinClient(user=user) as client:
        return await client.get_prices(codes=codes)


@app.get(path="/b3/prices", response_model=AssetCurrentPrice)
async def fetch_b3_current_prices(codes: List[str] = Query(...)):
    async with BrApiClient() as client:
        return await client.get_prices(codes=codes)


@app.get("/crypto/prices", response_model=AssetCurrentPrice)
async def get_crypto_prices(codes: List[str] = Query(...), currency: str = Query(...)):
    async with BrApiClient() as client:
        return await client.get_crypto_prices(codes=codes, currency=currency)


@app.get(
    path="/binance/prices",
    response_model=AssetCurrentPrice,
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
    deprecated=True,
)
async def fetch_binance_prices(
    username: str, codes: List[str] = Query(...), db: Session = Depends(get_db)
):
    user = await get_user(username=username, db=db)
    async with BinanceClient(user=user) as client:
        return await client.get_prices(codes=codes)


@app.get(
    path="/binance/transactions",
    response_model=List[BianceOrder],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def fetch_binance_transactions(
    username: str, start_datetime: Optional[datetime] = None, db: Session = Depends(get_db)
):
    # multiple by 1000 to convert from seconds to milliseconds
    start_timestamp = int(start_datetime.timestamp() * 1000) if start_datetime is not None else None
    user = await get_user(username=username, db=db)
    async with BinanceClient(user=user) as client:
        return await client.get_orders(start_timestamp=start_timestamp)


@app.post(path="/prices", response_model=AssetCurrentPrice)
async def fetch_prices(assets: List[AssetFetchCurrentPriceFilterSet]):
    async def get_b3_prices(codes: List[str]):
        async with BrApiClient() as c:
            return await c.get_b3_prices(codes=codes)

    async def get_crypto_prices(codes, currency):
        async with BrApiClient() as c:
            return await c.get_crypto_prices(codes=codes, currency=currency)

    b3_codes, brl_cryptos, usd_cryptos = [], [], []
    for asset in assets:
        if AssetTypes[asset.type] == AssetTypes.STOCK:
            b3_codes.append(asset.code)
        if AssetTypes[asset.type] == AssetTypes.CRYPTO:
            if asset.currency == "BRL":
                brl_cryptos.append(asset.code)
            else:
                usd_cryptos.append(asset.code)
    tasks = [
        get_b3_prices(codes=b3_codes),
        get_crypto_prices(codes=usd_cryptos, currency="USD"),
        get_crypto_prices(codes=brl_cryptos, currency="BRL"),
    ]
    return {
        code: price for result in await asyncio.gather(*tasks) for code, price in result.items()
    }


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
