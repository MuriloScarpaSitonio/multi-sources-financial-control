from django.utils import timezone

from ...adapters import DjangoSQLAssetMetaDataRepository
from ...domain.models import Asset as AssetDomainModel


def maybe_create_asset_metadata(asset: AssetDomainModel, **defaults) -> None:
    _maybe_create_asset_metadata(asset=asset, **defaults)


def _maybe_create_asset_metadata(asset: AssetDomainModel, **defaults) -> None:
    from ...integrations.helpers import fetch_asset_current_price, fetch_asset_sector

    # is_held_in_self_custody =
    # é um ativo custodiado pelo banco emissor?
    # (ou seja, aplica-se apenas para renda fixa e  nao pode ser sincronizado pela b3)
    repository = DjangoSQLAssetMetaDataRepository(
        code=asset.code,
        type=asset.type,
        currency=asset.currency,
        asset_id=asset.id if asset.is_held_in_self_custody else None,
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
