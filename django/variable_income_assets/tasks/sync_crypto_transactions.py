from datetime import datetime
from django.conf import settings

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory

from .shared import save_crypto_transactions


@shared_task(bind=True, name="sync_kucoin_transactions_task", base=TaskWithHistory)
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


@shared_task(bind=True, name="sync_binance_transactions_task", base=TaskWithHistory)
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
