from .clients import BrApiClient, TwelveDataClient
from ..choices import TransactionCurrencies


async def get_stock_prices(codes: list[str]) -> dict[str, float]:
    async with BrApiClient() as c:
        return await c.get_b3_prices(codes=codes)


async def get_crypto_prices(codes: list[str], currency: TransactionCurrencies):
    async with BrApiClient() as c:
        return await c.get_crypto_prices(codes=codes, currency=currency)


async def get_stocks_usa_prices(codes: list[str]):
    async with TwelveDataClient() as c:
        return await c.get_prices(codes=codes)
