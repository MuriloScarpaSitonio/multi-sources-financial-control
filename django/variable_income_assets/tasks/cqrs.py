from ..adapters.repositories import DjangoSQLAssetMetaDataRepository
from ..choices import ASSET_TYPE_CURRENCY_MAP
from ..models import Asset, AssetReadModel


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
                "adjusted_avg_price": asset.adjusted_avg_price,
                "total_bought": asset.total_bought,
                "total_invested": asset.total_invested,
                "total_invested_adjusted": asset.total_invested_adjusted,
            },
        )
    elif is_aggregate_upsert is False:
        asset = Asset.objects.only("pk", "user_id", "code", "type", "objective").get(pk=asset_id)
        AssetReadModel.objects.update_or_create(
            write_model_pk=asset.pk,
            defaults={
                "user_id": asset.user_id,
                "code": asset.code,
                "type": asset.type,
                "objective": asset.objective,
            },
        )
    elif is_aggregate_upsert is None:
        asset = Asset.objects.annotate_read_fields().get(pk=asset_id)
        metadata = DjangoSQLAssetMetaDataRepository(
            code=asset.code,
            type=asset.type,
            # The asset may not have transcations yet so we fallback
            # In such scenario the aggregation fields are all zero so we are good
            currency=asset.currency or ASSET_TYPE_CURRENCY_MAP[asset.type],
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
                "adjusted_avg_price": asset.adjusted_avg_price,
                "total_bought": asset.total_bought,
                "total_invested": asset.total_invested,
                "total_invested_adjusted": asset.total_invested_adjusted,
            },
        )
