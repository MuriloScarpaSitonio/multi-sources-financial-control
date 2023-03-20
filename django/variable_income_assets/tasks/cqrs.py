from celery import shared_task

from ..models import Asset, AssetReadModel


@shared_task
def upsert_asset_read_model(asset_id: int) -> None:
    try:
        asset: Asset = Asset.objects.prefetch_related("transactions", "incomes").get(pk=asset_id)
        # asset.currency = asset.currency_from_transactions or ""
        # asset.quantity_balance = asset.quantity_from_transactions
        # asset.avg_price = asset.avg_price_from_transactions
        # asset.adjusted_avg_price = asset.adjusted_avg_price_from_transactions
        # asset.roi = asset.get_roi()
        # asset.roi_percentage = asset.get_roi(percentage=True)
        # asset.total_invested = asset.total_invested_from_transactions
        # asset.save(
        #     update_fields=(
        #         "currency",
        #         "quantity_balance",
        #         "avg_price",
        #         "adjusted_avg_price",
        #         "roi",
        #         "roi_percentage",
        #         "total_invested",
        #     )
        # )
        AssetReadModel.objects.update_or_create(
            write_model_pk=asset_id,
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
    except Exception:
        # TODO: log error
        pass
