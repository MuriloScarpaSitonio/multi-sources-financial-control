from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from django.core.handlers.wsgi import WSGIRequest
from django.core.handlers.asgi import ASGIRequest
from django.http import HttpResponse
from django.utils import timezone

from .helpers import get_crypto_prices, get_stock_prices, get_stocks_usa_prices
from ..adapters.repositories import DjangoSQLAssetMetaDataRepository
from ..choices import AssetTypes, TransactionCurrencies

if TYPE_CHECKING:
    from django.db.models import QuerySet

    from ..models import AssetMetaData


async def _fetch_prices(
    qs: QuerySet[AssetMetaData],
) -> tuple[dict[str, AssetMetaData], dict[str, float]]:
    b3_codes: list[str] = []
    crypto_brl_codes: list[str] = []
    crypto_usd_codes: list[str] = []
    usa_stocks_codes: list[str] = []
    assets_map: dict[str, AssetMetaData] = {}
    async for asset in qs:
        assets_map[asset.code] = asset
        if asset.type == AssetTypes.stock:
            b3_codes.append(asset.code)
        elif asset.type == AssetTypes.stock_usa:
            usa_stocks_codes.append(asset.code)
        elif asset.type == AssetTypes.crypto:
            if asset.currency == TransactionCurrencies.real:
                crypto_brl_codes.append(asset.code)
            else:
                crypto_usd_codes.append(asset.code)
    tasks = [
        get_stock_prices(codes=b3_codes),
        get_crypto_prices(codes=crypto_usd_codes, currency=TransactionCurrencies.dollar),
        get_crypto_prices(codes=crypto_brl_codes, currency=TransactionCurrencies.real),
        get_stocks_usa_prices(codes=usa_stocks_codes),
    ]

    return assets_map, {
        code: price
        for result in await asyncio.gather(*tasks, return_exceptions=True)
        if not isinstance(result, Exception)
        for code, price in result.items()
    }


async def update_prices(_: ASGIRequest | WSGIRequest) -> HttpResponse:
    # TODO: apply authentication
    error = None
    try:
        assets_metadata_map, result = await _fetch_prices(
            qs=DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update()
        )
        for code, price in result.items():
            asset_metadata = assets_metadata_map[code]
            asset_metadata.current_price = str(price)
            asset_metadata.current_price_updated_at = timezone.now()

        await DjangoSQLAssetMetaDataRepository.abulk_update(
            objs=assets_metadata_map.values(), fields=("current_price", "current_price_updated_at")
        )

    except Exception as e:
        error = repr(e)

    return HttpResponse("", status=200 if error is None else 400)
