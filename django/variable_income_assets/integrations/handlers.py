from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.utils import timezone

from aiohttp import ClientResponseError

from ..adapters import DjangoSQLAssetMetaDataRepository
from ..choices import AssetTypes, Currencies
from .helpers import get_b3_prices, get_crypto_prices, get_stocks_usa_prices

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from ..models import AssetMetaData


async def _fetch_prices(
    qs: QuerySet[AssetMetaData],
) -> tuple[dict[str, AssetMetaData], list[dict[str, Any]]]:
    stock_codes: list[str] = []
    fii_codes: list[str] = []
    crypto_brl_codes: list[str] = []
    crypto_usd_codes: list[str] = []
    usa_stocks_codes: list[str] = []
    global_equity_codes: list[str] = []
    global_equity_brl_codes: list[str] = []
    assets_map: dict[str, AssetMetaData] = {}
    async for asset in qs:
        assets_map["-".join((asset.code, asset.type, asset.currency))] = asset
        if asset.type == AssetTypes.stock:
            stock_codes.append(asset.code)
        if asset.type == AssetTypes.fii:
            fii_codes.append(asset.code)
        elif asset.type == AssetTypes.stock_usa:
            usa_stocks_codes.append(asset.code)
        elif asset.type == AssetTypes.equity_global:
            if asset.currency == Currencies.real:
                global_equity_brl_codes.append(asset.code)
            else:
                global_equity_codes.append(asset.code)
        elif asset.type == AssetTypes.crypto:
            if asset.currency == Currencies.real:
                crypto_brl_codes.append(asset.code)
            else:
                crypto_usd_codes.append(asset.code)
    batches = [
        (stock_codes, AssetTypes.stock, Currencies.real, get_b3_prices),
        (fii_codes, AssetTypes.fii, Currencies.real, get_b3_prices),
        (crypto_usd_codes, AssetTypes.crypto, Currencies.dollar, get_crypto_prices),
        (crypto_brl_codes, AssetTypes.crypto, Currencies.real, get_crypto_prices),
        (usa_stocks_codes, AssetTypes.stock_usa, Currencies.dollar, get_stocks_usa_prices),
        (global_equity_codes, AssetTypes.equity_global, Currencies.dollar, get_stocks_usa_prices),
        (global_equity_brl_codes, AssetTypes.equity_global, Currencies.real, get_b3_prices),
    ]
    prices = []
    for codes, asset_type, currency, fetch in batches:
        if not codes:
            continue
        try:
            if asset_type == AssetTypes.crypto:
                result = await fetch(codes=codes, currency=currency)
            else:
                result = await fetch(codes=codes)
        except Exception as exc:
            reason = (
                f"HTTP {exc.status}" if isinstance(exc, ClientResponseError) else type(exc).__name__
            )
            print(f"{asset_type} {currency} {', '.join(codes)}: {reason}")
            result = {}
        prices.append(
            {
                "prices": {code: result.get(code) for code in codes},
                "type": asset_type,
                "currency": currency,
            }
        )

    return assets_map, prices


async def update_prices() -> Exception | None:
    missing = []
    updated = []
    try:
        assets_metadata_map, result = await _fetch_prices(
            qs=DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update()
        )
        print("update_prices result: ", result)
        for data in result:
            for code, price in data["prices"].items():
                if price is None:
                    missing.append(f"{code} ({data['type']} {data['currency']})")
                    continue
                asset_metadata = assets_metadata_map[
                    "-".join((code, data["type"], data["currency"]))
                ]
                asset_metadata.current_price = str(price)
                asset_metadata.current_price_updated_at = timezone.now()
                updated.append(asset_metadata)

        await DjangoSQLAssetMetaDataRepository.abulk_update(
            objs=updated, fields=("current_price", "current_price_updated_at")
        )

    except Exception as exc:
        return exc
    if missing:
        return RuntimeError("Price refresh incomplete: " + ", ".join(missing))
    return None
