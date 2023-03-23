from typing import Iterable

from celery import shared_task

from ..models import Asset, AssetReadModel


@shared_task
def upsert_assets_read_model(asset_ids: Iterable[int]) -> None:
    assets: Iterable[Asset] = Asset.objects.prefetch_related("transactions", "incomes").filter(
        pk__in=asset_ids
    )

    for asset in assets:
        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "user_id": asset.user_id,
                "code": asset.code,
                "type": asset.type,
                "sector": asset.sector,
                "objective": asset.objective,
                "current_price": asset.current_price or 0,
                "current_price_updated_at": asset.current_price_updated_at,
                "currency": asset.currency_from_transactions or "",
                "quantity_balance": asset.quantity_from_transactions,
                "avg_price": asset.avg_price_from_transactions,
                "adjusted_avg_price": asset.adjusted_avg_price_from_transactions,
                "roi": asset.get_roi(),
                "roi_percentage": asset.get_roi(percentage=True),
                "total_invested": asset.total_invested_from_transactions,
            },
        )
