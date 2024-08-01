from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from django.utils import timezone

from ..adapters import DjangoSQLAssetMetaDataRepository
from ..choices import AssetTypes, Currencies
from .helpers import get_b3_prices, get_crypto_prices, get_stocks_usa_prices

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from ..models import AssetMetaData


async def _fetch_prices(
    qs: QuerySet[AssetMetaData],
) -> tuple[dict[str, AssetMetaData], dict[str, float | str]]:
    stock_codes: list[str] = []
    fii_codes: list[str] = []
    crypto_brl_codes: list[str] = []
    crypto_usd_codes: list[str] = []
    usa_stocks_codes: list[str] = []
    assets_map: dict[str, AssetMetaData] = {}
    async for asset in qs:
        assets_map["-".join((asset.code, asset.type, asset.currency))] = asset
        if asset.type == AssetTypes.stock:
            stock_codes.append(asset.code)
        if asset.type == AssetTypes.fii:
            fii_codes.append(asset.code)
        elif asset.type == AssetTypes.stock_usa:
            usa_stocks_codes.append(asset.code)
        elif asset.type == AssetTypes.crypto:
            if asset.currency == Currencies.real:
                crypto_brl_codes.append(asset.code)
            else:
                crypto_usd_codes.append(asset.code)
    tasks = [
        get_b3_prices(codes=stock_codes),
        get_b3_prices(codes=fii_codes),
        get_crypto_prices(codes=crypto_usd_codes, currency=Currencies.dollar),
        get_crypto_prices(codes=crypto_brl_codes, currency=Currencies.real),
        get_stocks_usa_prices(codes=usa_stocks_codes),
    ]
    task_metadata = [
        {"type": AssetTypes.stock, "currency": Currencies.real},
        {"type": AssetTypes.fii, "currency": Currencies.real},
        {"type": AssetTypes.crypto, "currency": Currencies.dollar},
        {"type": AssetTypes.crypto, "currency": Currencies.real},
        {"type": AssetTypes.stock_usa, "currency": Currencies.dollar},
    ]
    prices = []

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for i, result in enumerate(results):  # order is guaranteed
        if isinstance(result, Exception):
            # TODO: log error
            print(repr(result))
            continue
        prices.append({"prices": result, **task_metadata[i]})

    return assets_map, prices


async def update_prices() -> Exception | None:
    exc = None
    try:
        assets_metadata_map, result = await _fetch_prices(
            qs=DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update()
        )
        for data in result:
            for code, price in data["prices"].items():
                asset_metadata = assets_metadata_map[
                    "-".join((code, data["type"], data["currency"]))
                ]
                asset_metadata.current_price = str(price)
                asset_metadata.current_price_updated_at = timezone.now()

        await DjangoSQLAssetMetaDataRepository.abulk_update(
            objs=assets_metadata_map.values(), fields=("current_price", "current_price_updated_at")
        )

    except Exception as e:
        # TODO: log error
        exc = e
        print(repr(exc))

    return exc
