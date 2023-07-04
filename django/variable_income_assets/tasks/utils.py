from datetime import date
from decimal import Decimal

from asgiref.sync import async_to_sync

from config.settings.dynamic import dynamic_settings

from ..choices import AssetSectors, AssetTypes, Currencies
from ..integrations.helpers import get_crypto_prices, get_stock_prices, get_stocks_usa_prices


# TODO: fetch API
def fetch_asset_sector(code: str, asset_type: AssetTypes) -> AssetSectors:
    sector = AssetSectors.unknown
    if asset_type == AssetTypes.crypto:
        sector = AssetSectors.tech
    elif asset_type == AssetTypes.fii:
        sector = AssetSectors.essential_consumption
    return sector


def fetch_asset_current_price(code: str, asset_type: AssetTypes, currency: Currencies) -> Decimal:
    kwargs = {"codes": (code,)}
    if asset_type == AssetTypes.stock:
        coro = get_stock_prices
    elif asset_type == AssetTypes.stock_usa:
        coro = get_stocks_usa_prices
    elif asset_type == AssetTypes.crypto:
        coro = get_crypto_prices
        kwargs["currency"] = currency

    try:
        result = async_to_sync(coro)(**kwargs)
        return Decimal(result[code])
    except Exception:
        # TODO: log error
        return Decimal()


# TODO: fetch API
def fetch_currency_conversion_rate(operation_date: date, currency: Currencies) -> Decimal | None:
    if currency == Currencies.real:
        return Decimal("1")
    return dynamic_settings.DOLLAR_CONVERSION_RATE
