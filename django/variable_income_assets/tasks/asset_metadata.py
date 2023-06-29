from django.utils import timezone

from .utils import guess_currency, fetch_asset_current_price, fetch_asset_sector
from ..models import Asset
from ..adapters.repositories import DjangoSQLAssetMetaDataRepository


# TODO: UoW?!
def maybe_create_asset_metadata(asset_pk: int) -> None:
    asset: Asset = Asset.objects.annotate_currency().only("code", "type").get(pk=asset_pk)

    currencies = (asset.currency,) if asset.currency else guess_currency(asset_type=asset.type)
    for currency in currencies:
        repository = DjangoSQLAssetMetaDataRepository(
            code=asset.code, type=asset.type, currency=currency
        )
        if repository.exists():
            continue

        repository.create(
            sector=fetch_asset_sector(code=asset.code, asset_type=asset.type),
            current_price=fetch_asset_current_price(
                code=asset.code, asset_type=asset.type, currency=currency
            ),
            current_price_updated_at=timezone.now(),
        )
