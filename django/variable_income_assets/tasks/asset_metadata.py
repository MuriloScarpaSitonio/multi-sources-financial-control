from functools import singledispatch

from django.utils import timezone

from ..adapters import DjangoSQLAssetMetaDataRepository
from ..models import Asset


# TODO: UoW?!
@singledispatch
def maybe_create_asset_metadata(asset: int, **defaults) -> None:
    asset: Asset = Asset.objects.only("code", "type", "currency").get(pk=asset)
    _maybe_create_asset_metadata(asset=asset, **defaults)


@maybe_create_asset_metadata.register
def _(asset: Asset, **defaults) -> None:
    _maybe_create_asset_metadata(asset=asset, **defaults)


def _maybe_create_asset_metadata(asset: Asset, **defaults) -> None:
    from ..integrations.helpers import fetch_asset_current_price, fetch_asset_sector

    repository = DjangoSQLAssetMetaDataRepository(
        code=asset.code, type=asset.type, currency=asset.currency
    )
    if not repository.exists():
        repository.create(
            sector=defaults.get(
                "sector", fetch_asset_sector(code=asset.code, asset_type=asset.type)
            ),
            current_price=defaults.get(
                "current_price",
                fetch_asset_current_price(
                    code=asset.code, asset_type=asset.type, currency=asset.currency
                ),
            ),
            current_price_updated_at=defaults.get("current_price_updated_at", timezone.now()),
        )
