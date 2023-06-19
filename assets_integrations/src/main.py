from datetime import date as date_typing, datetime
from decimal import Decimal
from typing import Iterator, List, Optional

from fastapi import Depends, FastAPI, status

from sqlmodel import Session, SQLModel

from .clients import AwesomeApiClient, BinanceClient, CeiCrawler, KuCoinClient
from .database import engine
from .schemas import (
    BinanceFiatTransaction,
    BinanceTradeTransaction,
    BinanceTransaction,
    CeiTransaction,
    KuCoinOrder,
    NotFoundResponse,
    PassiveIncome,
)
from .database.crud import get_user

app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    SQLModel.metadata.create_all(engine)


def get_db() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@app.get(
    path="/cei/transactions",
    response_model=List[CeiTransaction],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
    deprecated=True,
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
    deprecated=True,
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
    path="/binance/transactions",
    response_model=List[BinanceTransaction],
    responses={status.HTTP_404_NOT_FOUND: {"model": NotFoundResponse}},
)
async def fetch_binance_transactions(
    username: str, start_datetime: Optional[datetime] = None, db: Session = Depends(get_db)
):
    # multiple by 1000 to convert from seconds to milliseconds
    start_timestamp = int(start_datetime.timestamp() * 1000) if start_datetime is not None else 0
    user = await get_user(username=username, db=db)
    async with BinanceClient(user=user) as client:
        (
            trade_transactions,
            bought_fiat_transactions,
            sold_fiat_transactions,
        ) = await client.get_orders(start_timestamp=start_timestamp)

    trade_transactions = [
        BinanceTradeTransaction(**transaction) for transaction in trade_transactions
    ]
    bought_fiat_transactions = [
        BinanceFiatTransaction(**transaction, action="BUY")
        for transaction in bought_fiat_transactions
    ]
    sold_fiat_transactions = [
        BinanceFiatTransaction(**transaction, action="SELL")
        for transaction in sold_fiat_transactions
    ]
    return trade_transactions + bought_fiat_transactions + sold_fiat_transactions


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
