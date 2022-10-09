from datetime import timedelta

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
from ..models import Asset


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
            asset, created = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.stock,
            )
            if created:
                asset.current_price = serializer.data["unit_price"]
                asset.current_price_updated_at = serializer.data["operation_date"]
                asset.save(update_fields=("current_price", "current_price_updated_at"))

        transaction, created = serializer.get_or_create(asset=asset)

        update_fields = []
        if transaction.action == TransactionActions.sell:
            # we must save each transaction individually to make sure we are setting
            # `initial_price` accorddingly
            transaction.initial_price = asset.avg_price_from_transactions
            update_fields.append("initial_price")

        if created:
            transaction.fetched_by = task_history
            update_fields.append("fetched_by")

        if update_fields:
            transaction.save(update_fields=update_fields)


@shared_task(
    bind=True,
    name="sync_cei_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações do CEI",
)
def sync_cei_transactions_task(self, username: str) -> int:
    last_run_at = self.get_last_run(username=username)
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("cei/", "transactions"),
        query_params={
            "username": username,
            # CEI transactions may have a one day delay
            "start_date": last_run_at.date() - timedelta(days=1) if last_run_at else None,
            "end_date": timezone.now().date(),
        },
    )
    _save_cei_transactions(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )
