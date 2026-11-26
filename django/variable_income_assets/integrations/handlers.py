from __future__ import annotations

from collections import defaultdict
from functools import partial

from django.utils import timezone

from aiohttp import ClientResponseError

from ..adapters import DjangoSQLAssetMetaDataRepository
from ..choices import AssetTypes, Currencies
from .helpers import get_b3_prices, get_crypto_prices, get_stocks_usa_prices


async def update_prices() -> Exception | None:
    providers = {
        (AssetTypes.stock, Currencies.real): get_b3_prices,
        (AssetTypes.fii, Currencies.real): get_b3_prices,
        (AssetTypes.equity_global, Currencies.real): get_b3_prices,
        (AssetTypes.crypto, Currencies.dollar): partial(
            get_crypto_prices, currency=Currencies.dollar
        ),
        (AssetTypes.crypto, Currencies.real): partial(get_crypto_prices, currency=Currencies.real),
        (AssetTypes.stock_usa, Currencies.dollar): get_stocks_usa_prices,
        (AssetTypes.equity_global, Currencies.dollar): get_stocks_usa_prices,
    }
    groups = defaultdict(list)
    updated = []
    failures = []
    try:
        async for asset in DjangoSQLAssetMetaDataRepository.filter_assets_eligible_for_update():
            groups[asset.type, asset.currency].append(asset)

        for group, fetch in providers.items():
            assets = groups.get(group)
            if not assets:
                continue
            codes = list(dict.fromkeys(asset.code for asset in assets))
            try:
                prices = await fetch(codes=codes)
            except Exception as exc:
                reason = (
                    f"HTTP {exc.status}"
                    if isinstance(exc, ClientResponseError)
                    else type(exc).__name__
                )
                failures.append(f"{group[0]} {group[1]} ({reason}): {', '.join(codes)}")
                continue
            missing = [code for code in codes if prices.get(code) is None]
            if missing:
                failures.append(f"{group[0]} {group[1]} (no quote): {', '.join(missing)}")
            for asset in assets:
                price = prices.get(asset.code)
                if price is not None:
                    asset.current_price = str(price)
                    asset.current_price_updated_at = timezone.now()
                    updated.append(asset)

        await DjangoSQLAssetMetaDataRepository.abulk_update(
            objs=updated, fields=("current_price", "current_price_updated_at")
        )
    except Exception as exc:
        return exc
    if failures:
        return RuntimeError("Price refresh incomplete: " + "; ".join(failures))
    return None
