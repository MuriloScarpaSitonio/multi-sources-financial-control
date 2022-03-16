from django.db.transaction import atomic

from django.conf import settings

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory

from .serializers import CryptoTransactionAlreadyExistsException, CryptoTransactionSerializer
from ..choices import AssetTypes
from ..models import Asset


@shared_task(
    bind=True,
    name="sync_kucoin_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações da KuCoin",
)
def sync_kucoin_transactions_task(self, username: str) -> int:
    url = build_url(
        url=settings.CRAWLERS_URL,
        parts=("kucoin/", "transactions"),
        query_params={"username": username},
    )
    save_crypto_transactions(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )


@shared_task(
    bind=True,
    name="sync_binance_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações da Binance",
)
def sync_binance_transactions_task(self, username: str) -> int:
    url = build_url(
        url=settings.CRAWLERS_URL,
        parts=("binance/", "transactions"),
        query_params={"username": username, "start_datetime": self.get_last_run(username=username)},
    )
    save_crypto_transactions(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )


@atomic
def save_crypto_transactions(
    response: requests.Response, user: CustomUser, task_history: TaskHistory
) -> None:
    assets = dict()
    for data in response.json():
        print(data)
        code = data.pop("code")
        if data["currency"] == "USDT":
            data.update(currency="USD")
        serializer = CryptoTransactionSerializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except CryptoTransactionAlreadyExistsException:
            continue

        asset = assets.get(code)
        if asset is None:
            asset, _ = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.crypto,
            )

        serializer.create(asset=asset, task_history=task_history)
