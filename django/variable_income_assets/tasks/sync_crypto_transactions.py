from django.db.transaction import atomic
from django.conf import settings
from django.utils import timezone

import requests

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.choices import TaskStates
from tasks.decorators import task_finisher
from tasks.models import TaskHistory

from .asset_metadata import maybe_create_asset_metadata
from .serializers import CryptoTransactionSerializer
from ..choices import AssetObjectives, AssetSectors, AssetTypes
from ..models import Asset
from ..domain.events import TransactionsCreated
from ..service_layer.unit_of_work import DjangoUnitOfWork


@task_finisher
def sync_kucoin_transactions_task(task_history_id: str, username: str) -> int:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("kucoin/", "transactions"),
        query_params={"username": username},
    )
    save_crypto_transactions(
        transactions_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=task_history_id,
    )


@task_finisher
def sync_binance_transactions_task(task_history_id: str, username: str) -> int:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("binance/", "transactions"),
        query_params={
            "username": username,
            "start_datetime": (
                TaskHistory.objects.filter(
                    name="sync_binance_transactions_task",
                    state=TaskStates.success,
                    created_by__username=username,
                )
                .values_list("finished_at", flat=True)
                .first()
            ),
        },
    )
    save_crypto_transactions(
        transactions_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=task_history_id,
    )


def save_crypto_transactions(
    transactions_data: list[dict], user: CustomUser, task_history_id: str
) -> None:
    assets: set[Asset] = set()
    for data in transactions_data:
        # TODO: order data so we create `BUY` transactions first
        try:
            code = data.pop("code")
            if code in settings.CRYPTOS_TO_SKIP_INTEGRATION:
                continue

            if data["currency"] == "USDT":
                data.update(currency="USD")

            currency = data.pop("currency")

            serializer = CryptoTransactionSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            with atomic():
                asset, created = Asset.objects.annotate_for_domain().get_or_create(
                    user=user,
                    code=code,
                    type=AssetTypes.crypto,
                    currency=currency,
                    defaults={"objective": AssetObjectives.growth},
                )
                if created:
                    maybe_create_asset_metadata(
                        asset,
                        sector=AssetSectors.tech,
                        current_price=serializer.data["price"],
                        current_price_updated_at=timezone.now(),
                    )
                serializer.create(asset=asset, task_history_id=task_history_id)

                asset.__created__ = created
                assets.add(asset)  # it's ok to not overwrite the asset object because it'll
                # be queried again in the emitted event below. In fact, this is necessary so we don't
                # overwrite `__created__`
        except Exception:
            # TODO: log error
            continue

    from ..service_layer import messagebus  # avoid cirtular import error

    for asset in assets:
        # TODO: rollback transactions related to this asset if fails?!
        with DjangoUnitOfWork(asset_pk=asset.pk) as uow:
            messagebus.handle(
                message=TransactionsCreated(asset_pk=asset.pk, new_asset=asset.__created__), uow=uow
            )
