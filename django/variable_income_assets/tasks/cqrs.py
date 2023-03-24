from celery import shared_task

from ..models import Asset, AssetReadModel


@shared_task
def upsert_asset_read_model(asset_id: int, is_aggregate_upsert: bool = False) -> None:
    if is_aggregate_upsert:
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
    else:
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
