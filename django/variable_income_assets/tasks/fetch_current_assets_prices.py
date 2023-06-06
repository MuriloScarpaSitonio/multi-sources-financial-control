from typing import List

from django.conf import settings
from django.utils import timezone

import requests

from shared.utils import build_url
from tasks.decorators import task_finisher

from ..domain.events import AssetUpdated
from ..models import Asset


@task_finisher
def fetch_current_assets_prices(task_history_id: str, codes: List[str], username: str) -> None:
    url = build_url(
        url=settings.ASSETS_INTEGRATIONS_URL, parts=("prices",), query_params={"username": username}
    )
    qs = (
        Asset.objects.filter(user__username=username, code__in=codes)
        .annotate_currency()
        .values("code", "type", "currency")
        .distinct()
    )
    response = requests.post(url, json=list(qs))
    for code, price in response.json().items():
        qs.filter(code=code).update(
            current_price=str(price), current_price_updated_at=timezone.now()
        )

    from ..service_layer import messagebus
    from ..service_layer.unit_of_work import DjangoUnitOfWork

    for pk in qs.values_list("pk", flat=True):
        with DjangoUnitOfWork(asset_pk=pk) as uow:
            messagebus.handle(message=AssetUpdated(asset_pk=pk), uow=uow)
