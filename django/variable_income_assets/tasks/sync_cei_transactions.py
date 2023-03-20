from datetime import datetime, timedelta
from typing import List

from django.conf import settings
from django.db.transaction import atomic
from django.utils import timezone

import requests
from celery import shared_task

from authentication.models import CustomUser
from shared.utils import build_url
from tasks.bases import TaskWithHistory

from .serializers import CeiTransactionSerializer
from ..choices import AssetTypes
from ..models import Asset


def _resolve_code(code: str, market_type: str) -> str:
    """If the asset is from fractional market we dont create an specific record for it"""
    return code[:-1] if market_type == "fractional_share" else code


def _save_cei_transactions(
    transactions_data: List[dict], user: CustomUser, task_history_id: int
) -> None:  # pragma: no cover
    for data in transactions_data:
        try:
            code = _resolve_code(
                code=data.pop("raw_negotiation_code"), market_type=data.pop("market_type")
            )

            serializer = CeiTransactionSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            with atomic():
                asset, created = Asset.objects.get_or_create(
                    user=user, code=code, type=AssetTypes.stock
                )
                if created:
                    asset.current_price = serializer.validated_data["unit_price"]
                    asset.current_price_updated_at = datetime.combine(
                        serializer.validated_data["operation_date"],
                        datetime.min.time(),
                        tzinfo=timezone.utc,
                    )
                    asset.save(update_fields=("current_price", "current_price_updated_at"))

                serializer.create(asset=asset, task_history_id=task_history_id)
        except Exception:
            # TODO: log error
            continue


@shared_task(
    bind=True,
    name="sync_cei_transactions_task",
    base=TaskWithHistory,
    notification_display="Transações do CEI",
    deprecated=True,
)
def sync_cei_transactions_task(self, username: str) -> int:  # pragma: no cover
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
        transactions_data=requests.get(url).json(),
        user=CustomUser.objects.get(username=username),
        task_history_id=self.request.id,
    )
