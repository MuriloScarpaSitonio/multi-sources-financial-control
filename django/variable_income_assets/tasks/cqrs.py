from typing import Optional

from celery import shared_task

from ..models import Asset, AssetReadModel


@shared_task
def upsert_asset_read_model(asset_id: int, is_aggregate_upsert: Optional[bool] = None) -> None:
    """Upsert the respective `AssetReadModel` of a given `Asset` (write model).

    Args:
        asset_id (int): `Asset` primary key;
        is_aggregate_upsert (Optional[bool]): A flag that tries to simplify the upsert uperation.
            1) If `True` indicates that only the aggregated fields should be updated. Should be
                used with any events related to `Transaction` or `PassiveIncome`;
            2) If `False` indicates that only the non-aggregated fields should be updated.
                Should be used when the given `Asset` is created or updated;
            3) If `None`, update all fields. Used in commands and tests contexts.

            Defaults to `None`.
    """
    if is_aggregate_upsert is True:
        asset: Asset = Asset.objects.annotate_read_fields().get(pk=asset_id)

        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "currency": asset.currency,
                "quantity_balance": asset.quantity_balance,
                "avg_price": asset.avg_price,
                "adjusted_avg_price": asset.adjusted_avg_price,
                "roi": asset.roi,
                "roi_percentage": asset.roi_percentage,
                "total_invested": asset.total_invested,
            },
        )
    elif is_aggregate_upsert is False:
        asset: Asset = Asset.objects.get(pk=asset_id)

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
            },
        )
    elif is_aggregate_upsert is None:
        asset: Asset = Asset.objects.annotate_read_fields().get(pk=asset_id)

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
                "currency": asset.currency,
                "quantity_balance": asset.quantity_balance,
                "avg_price": asset.avg_price,
                "adjusted_avg_price": asset.adjusted_avg_price,
                "roi": asset.roi,
                "roi_percentage": asset.roi_percentage,
                "total_invested": asset.total_invested,
            },
        )
