from ...adapters import DjangoSQLAssetMetaDataRepository
from ...models import Asset, AssetReadModel


def upsert_asset_read_model(asset_id: int, is_aggregate_upsert: bool | None = None) -> None:
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
        asset = Asset.objects.annotate_read_fields().get(pk=asset_id)

        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "currency": asset.currency,
                "quantity_balance": asset.quantity_balance,
                "avg_price": asset.avg_price,
                "normalized_avg_price": asset.normalized_avg_price,
                "normalized_total_bought": asset.normalized_total_bought,
                "normalized_total_sold": asset.normalized_total_sold,
                "normalized_closed_roi": asset.normalized_closed_roi,
                "credited_incomes": asset.credited_incomes,
                "normalized_credited_incomes": asset.normalized_credited_incomes,
            },
        )
    elif is_aggregate_upsert is False:
        asset = Asset.objects.only("pk", "user_id", "code", "type", "objective").get(pk=asset_id)
        metadata = DjangoSQLAssetMetaDataRepository(
            code=asset.code, type=asset.type, currency=asset.currency
        ).get("pk")
        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "user_id": asset.user_id,
                "code": asset.code,
                "type": asset.type,
                "currency": asset.currency,
                "objective": asset.objective,
                "metadata_id": metadata.pk,
            },
        )
    elif is_aggregate_upsert is None:
        asset: Asset = Asset.objects.annotate_read_fields().get(pk=asset_id)
        metadata = DjangoSQLAssetMetaDataRepository(
            code=asset.code, type=asset.type, currency=asset.currency
        ).get("pk")

        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "user_id": asset.user_id,
                "metadata_id": metadata.pk,
                "code": asset.code,
                "type": asset.type,
                "objective": asset.objective,
                "currency": asset.currency,
                "quantity_balance": asset.quantity_balance,
                "avg_price": asset.avg_price,
                "normalized_avg_price": asset.normalized_avg_price,
                "normalized_total_bought": asset.normalized_total_bought,
                "normalized_total_sold": asset.normalized_total_sold,
                "normalized_closed_roi": asset.normalized_closed_roi,
                "credited_incomes": asset.credited_incomes,
                "normalized_credited_incomes": asset.normalized_credited_incomes,
            },
        )
