from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.choices import TaskStates
from tasks.decorators import task_finisher
from tasks.models import TaskHistory

from .serializers import CeiPassiveIncomeSerializer
from ..choices import AssetTypes
from ..models import Asset


def _save_cei_passive_incomes(
    incomes_data: list[str], user: CustomUser, task_history_id: str
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
                    income.fetched_by_id = task_history_id
                    income.save(update_fields=("fetched_by",))
        except Exception:
            # TODO: log error
            continue


@task_finisher
def sync_cei_passive_incomes_task(task_history_id: str, username: str) -> int:  # pragma: no cover
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL,
        parts=("cei/", "passive_incomes"),
        query_params={
            "username": username,
            "start_date": (
                TaskHistory.objects.filter(
                    name="sync_cei_passive_incomes_task",
                    state=TaskStates.success,
                    created_by__username=username,
                )
                .values_list("finished_at", flat=True)
                .first()
            ),
            "end_date": timezone.localdate(),
        },
    )
    _save_cei_passive_incomes(
        incomes_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=task_history_id,
    )
