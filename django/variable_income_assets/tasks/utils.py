from decimal import Decimal

from asgiref.sync import async_to_sync

from ..choices import AssetSectors, AssetTypes, TransactionCurrencies
from ..integrations.helpers import get_crypto_prices, get_stock_prices, get_stocks_usa_prices


def guess_currency(asset_type: AssetTypes) -> tuple[TransactionCurrencies, ...]:
    return AssetTypes.get_choice(asset_type).valid_currencies


def fetch_asset_sector(code: str, asset_type: AssetTypes) -> AssetSectors:
    sector = AssetSectors.unknown
    if asset_type == AssetTypes.crypto:
        sector = AssetSectors.tech
    elif asset_type == AssetTypes.fii:
        sector = AssetSectors.essential_consumption
    return sector


def fetch_asset_current_price(
    code: str, asset_type: AssetTypes, currency: TransactionCurrencies
) -> Decimal:
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
