from typing import List

from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory
from tasks.models import TaskHistory

from .serializers import CeiPassiveIncomeSerializer
from ..choices import AssetTypes
from ..models import Asset


def _save_cei_passive_incomes(
    incomes_data: List[str], user: CustomUser, task_history: TaskHistory
) -> None:  # pragma: no cover
    for data in incomes_data:
        try:
            code = data.pop("raw_negotiation_code")
            with atomic():
                if asset is None:
                    asset, _ = Asset.objects.get_or_create(
                        user=user,
                        code=code,
                        type=AssetTypes.stock,
                    )

                serializer = CeiPassiveIncomeSerializer(data=data)
                serializer.is_valid(raise_exception=True)
                income, created = serializer.update_or_create(asset=asset)
                if created:
                    income.fetched_by = task_history
                    income.save(update_fields=("fetched_by",))
        except Exception:
            # TODO: log error
            continue


@shared_task(
    bind=True,
    name="sync_cei_passive_incomes_task",
    base=TaskWithHistory,
    notification_display="Renda passiva do CEI",
    deprecated=True,
)
def sync_cei_passive_incomes_task(self, username: str) -> int:  # pragma: no cover
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("cei/", "passive_incomes"),
        query_params={
            "username": username,
            "start_date": self.get_last_run(username=username),
            "end_date": timezone.localdate(),
        },
    )
    _save_cei_passive_incomes(
        incomes_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history=TaskHistory.objects.get(pk=self.request.id),
    )
