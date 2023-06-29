from django.db.transaction import atomic
from django.conf import settings
from django.utils import timezone

import requests

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.choices import TaskStates
from tasks.decorators import task_finisher
from tasks.models import TaskHistory

from .serializers import CryptoTransactionSerializer
from ..adapters.repositories import DjangoSQLAssetMetaDataRepository
from ..choices import AssetObjectives, AssetSectors, AssetTypes
from ..models import Asset


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
    for data in transactions_data:
        try:
            code = data.pop("code")
            if code in settings.CRYPTOS_TO_SKIP_INTEGRATION:
                continue

            if data["currency"] == "USDT":
                data.update(currency="USD")

            serializer = CryptoTransactionSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            with atomic():
                asset, created = Asset.objects.annotate_for_domain().get_or_create(
                    user=user,
                    code=code,
                    type=AssetTypes.crypto,
                    defaults={"objective": AssetObjectives.growth},
                )
                if created:
                    # TODO: Emit event instead?!
                    repository = DjangoSQLAssetMetaDataRepository(
                        code=code, type=AssetTypes.crypto, currency=data["currency"]
                    )
                    if not repository.exists():
                        repository.create(
                            sector=AssetSectors.tech,
                            current_price=serializer.data["price"],
                            current_price_updated_at=timezone.now(),
                        )

                serializer.create(asset=asset, task_history_id=task_history_id, new_asset=created)
        except Exception:
            # TODO: log error
            continue
