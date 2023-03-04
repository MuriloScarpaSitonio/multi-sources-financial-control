from typing import List

from django.db.transaction import atomic
from django.conf import settings
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory

from .serializers import CryptoTransactionSerializer
from ..choices import AssetObjectives, AssetSectors, AssetTypes
from ..models import Asset


@shared_task(
    bind=True,
    name="sync_kucoin_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações da KuCoin",
)
def sync_kucoin_transactions_task(self, username: str) -> int:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("kucoin/", "transactions"),
        query_params={"username": username},
    )
    save_crypto_transactions(
        transactions_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=self.request.id,
    )


@shared_task(
    bind=True,
    name="sync_binance_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações da Binance",
)
def sync_binance_transactions_task(self, username: str) -> int:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("binance/", "transactions"),
        query_params={"username": username, "start_datetime": self.get_last_run(username=username)},
    )
    save_crypto_transactions(
        transactions_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=self.request.id,
    )


def save_crypto_transactions(
    transactions_data: List[dict], user: CustomUser, task_history_id: int
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
                asset, created = Asset.objects.get_or_create(
                    user=user,
                    code=code,
                    type=AssetTypes.crypto,
                    defaults={"sector": AssetSectors.tech, "objective": AssetObjectives.growth},
                )
            if created:
                asset.current_price = serializer.data["price"]
                asset.current_price_updated_at = timezone.now()
                asset.save(update_fields=("current_price", "current_price_updated_at"))

            serializer.create(asset=asset, task_history_id=task_history_id)
        except Exception:
            # TODO: log error
            continue
