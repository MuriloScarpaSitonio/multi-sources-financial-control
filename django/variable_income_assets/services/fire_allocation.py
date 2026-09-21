from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.utils import timezone

from dateutil.relativedelta import relativedelta

from expenses.models import BankAccount

from ..choices import AssetTypes, FixedIncomeIndexers
from ..models import AssetReadModel


@dataclass(frozen=True)
class FireAllocationAsset:
    id: int
    code: str
    description: str
    total: Decimal


@dataclass(frozen=True)
class FireAllocationBucket:
    category: str
    series: str | None
    total: Decimal
    assets: tuple[FireAllocationAsset, ...] = ()


_BUCKET_ORDER = (
    "BR_EQUITY",
    "US_EQUITY",
    "GLOBAL_EQUITY",
    "FII",
    "CRYPTO",
    "FIXED_CDI",
    "FIXED_SELIC",
    "FIXED_PREFIXED",
    "FIXED_IPCA",
    "CASH",
)


def classify_return_bucket(
    *, asset_type: str, indexer: str, maturity_date: date | None, today: date
) -> tuple[str, str | None]:
    if asset_type == AssetTypes.stock:
        return "BR_EQUITY", "IBOV"
    if asset_type == AssetTypes.stock_usa:
        return "US_EQUITY", None
    if asset_type == AssetTypes.equity_global:
        return "GLOBAL_EQUITY", None
    if asset_type == AssetTypes.fii:
        return "FII", "IFIX"
    if asset_type == AssetTypes.crypto:
        return "CRYPTO", None
    if indexer == FixedIncomeIndexers.cdi:
        return "FIXED_CDI", "CDI"
    if indexer == FixedIncomeIndexers.selic:
        return "FIXED_SELIC", "IMA_S"
    if indexer == FixedIncomeIndexers.prefixed:
        series = "IRF_M_1" if maturity_date <= today + relativedelta(years=1) else "IRF_M_1_PLUS"
        return "FIXED_PREFIXED", series
    series = "IMA_B_5" if maturity_date <= today + relativedelta(years=5) else "IMA_B_5_PLUS"
    return "FIXED_IPCA", series


def build_fire_allocation(*, user_id: int, today: date | None = None) -> list[FireAllocationBucket]:
    today = today or timezone.localdate()
    totals: dict[tuple[str, str | None], Decimal] = {}
    holdings: dict[tuple[str, str | None], list[FireAllocationAsset]] = {}
    assets = AssetReadModel.objects.filter(user_id=user_id).annotate_normalized_current_total()
    for asset in assets:
        bucket = classify_return_bucket(
            asset_type=asset.type,
            indexer=asset.indexer,
            maturity_date=asset.maturity_date,
            today=today,
        )
        total = asset.normalized_current_total
        totals[bucket] = totals.get(bucket, Decimal()) + total
        if total:
            holdings.setdefault(bucket, []).append(
                FireAllocationAsset(
                    id=asset.write_model_pk,
                    code=asset.code,
                    description=asset.description,
                    total=total,
                )
            )

    cash_total = BankAccount.objects.get_total(user_id)
    if cash_total:
        totals[("CASH", "CASH")] = cash_total

    order = {category: position for position, category in enumerate(_BUCKET_ORDER)}
    return [
        FireAllocationBucket(
            category=category,
            series=series,
            total=total,
            assets=tuple(
                sorted(holdings.get((category, series), []), key=lambda item: (item.code, item.id))
            ),
        )
        for (category, series), total in sorted(totals.items(), key=lambda item: order[item[0][0]])
        if total
    ]
