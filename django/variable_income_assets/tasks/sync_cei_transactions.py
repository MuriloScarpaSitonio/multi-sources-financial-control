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
    for infos in response.json():
        code = _resolve_code(code=infos["raw_negotiation_code"], market_type=infos["market_type"])
        asset = assets.get(code)
        if asset is None:
            asset, _ = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.stock,
            )

        transaction, created = Transaction.objects.get_or_create(
            asset=asset,
            price=infos["unit_price"],
            quantity=infos["unit_amount"],
            created_at=infos["operation_date"],
            defaults={"action": getattr(TransactionActions, infos["action"])},
        )

        update_fields = tuple()
        if transaction.action == TransactionActions.sell:
            # we must save each transaction individually to make sure we are setting
            # `initial_price` accorddingly
            transaction.initial_price = asset.avg_price
            update_fields += ("initial_price",)

        if created:
            transaction.fetched_by = task_history
            update_fields += ("fetched_by",)

        if update_fields:
            transaction.save(update_fields=update_fields)


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
