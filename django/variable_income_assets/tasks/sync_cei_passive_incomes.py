from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory

from ..choices import (
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
)
from ..models import Asset, PassiveIncome


@atomic
def _save_cei_passive_incomes(
    response: requests.models.Response, user: CustomUser, task_history: TaskHistory
) -> None:
    assets = dict()
    for passive_income in response.json():
        income_type = passive_income["income_type"]
        # TODO: change this on FastAPI
        if income_type == "FII yield":
            income_type = "income"
        code = passive_income["raw_negotiation_code"]
        asset = assets.get(code)
        if asset is None:
            asset, _ = Asset.objects.get_or_create(
                user=user,
                code=code,
                type=AssetTypes.stock,
            )

        # TODO: fix PassiveIncome.MultipleObjectsReturned
        income, created = PassiveIncome.objects.update_or_create(
            asset=asset,
            type=getattr(PassiveIncomeTypes, income_type),
            amount=passive_income["net_value"],
            defaults={
                "operation_date": passive_income["operation_date"],
                "event_type": getattr(PassiveIncomeEventTypes, passive_income["event_type"]),
            },
        )

        if created:
            income.fetched_by = task_history
            income.save(update_fields=("fetched_by",))


@shared_task(
    bind=True,
    name="sync_cei_passive_incomes_task",
    base=TaskWithHistory,
    notification_display="Renda passiva do CEI",
)
def sync_cei_passive_incomes_task(self, username: str) -> int:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("cei/", "passive_incomes"),
        query_params={"username": username, "date": timezone.now().date()},
    )
    _save_cei_passive_incomes(
        response=requests.get(url),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )
