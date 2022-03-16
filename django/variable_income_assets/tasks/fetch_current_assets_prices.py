from typing import List

from django.conf import settings
from django.utils import timezone
from django.db.models import F

import requests
from celery import shared_task

from shared.utils import build_url
from tasks.bases import TaskWithHistory

from ..models import Asset


@shared_task(
    name="fetch_current_assets_prices",
    base=TaskWithHistory,
    notification_display="Atualização de preços",
)
def fetch_current_assets_prices(codes: List[str], username: str) -> None:
    url = build_url(
        url=settings.CRAWLERS_URL, parts=("prices",), query_params={"username": username}
    )
    qs = (
        Asset.objects.filter(user__username=username, code__in=codes)
        .values("code", "type", "transactions__currency")
        .annotate(currency=F("transactions__currency"))
        .values("code", "type", "currency")
        .distinct()
    )
    response = requests.post(url, json=list(qs))
    for code, price in response.json().items():
        qs.filter(code=code).update(
            current_price=str(price), current_price_updated_at=timezone.now()
        )
