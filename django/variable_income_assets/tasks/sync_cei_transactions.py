from datetime import timedelta
from typing import Dict, Union

from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory

from .serializers import CeiTransactionSerializer
from ..choices import AssetTypes, TransactionActions
from ..models import Asset, Transaction


def _resolve_code(code: str, market_type: str) -> str:
    """If the asset is from fractional market we dont create an specific record for it"""
    return code[:-1] if market_type == "fractional_share" else code


@atomic
def _save_cei_transactions(
    response: requests.models.Response, user: CustomUser, task_history: TaskHistory
) -> None:
    assets = dict()
    for data in response.json():
        code = _resolve_code(
            code=data.pop("raw_negotiation_code"), market_type=data.pop("market_type")
        )
        serializer = CeiTransactionSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        asset = assets.get(code)
        if asset is None:
            asset, _ = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.stock,
            )

        transaction = serializer.create(asset=asset, task_history=task_history)

        if transaction.action == TransactionActions.sell:
            # we must save each transaction individually to make sure we are setting
            # `initial_price` accorddingly
            transaction.initial_price = asset.avg_price_from_transactions
            transaction.save(update_fields=("initial_price",))


@shared_task(bind=True, name="sync_cei_transactions_task", base=TaskWithHistory)
def sync_cei_transactions_task(self, username: str) -> int:
    url = build_url(
        url=settings.CRAWLERS_URL,
        parts=("cei/", "transactions"),
        query_params={
            "username": username,
            # there's one day delay for transactions to appear at CEI
            "start_date": self.get_last_run(
                username=username, as_date=True, timedelta_kwargs={"days": 1}
            ),
            "end_date": timezone.now().date() - timedelta(days=1),
        },
    )
    _save_cei_transactions(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )
