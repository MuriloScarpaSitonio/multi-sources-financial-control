from django.utils import timezone

from .utils import fetch_asset_current_price, fetch_asset_sector
from ..models import Asset
from ..adapters.repositories import DjangoSQLAssetMetaDataRepository


# TODO: UoW?!
def maybe_create_asset_metadata(asset_pk: int) -> None:
    asset: Asset = Asset.objects.only("code", "type", "currency").get(pk=asset_pk)

    repository = DjangoSQLAssetMetaDataRepository(
        code=asset.code, type=asset.type, currency=asset.currency
    )
    if repository.exists():
        return

    repository.create(
        sector=fetch_asset_sector(code=asset.code, asset_type=asset.type),
        current_price=fetch_asset_current_price(
            code=asset.code, asset_type=asset.type, currency=asset.currency
        ),
        current_price_updated_at=timezone.now(),
    )
