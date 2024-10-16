from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils import timezone

from dateutil.relativedelta import relativedelta

if TYPE_CHECKING:
    from ...models import Expense, Revenue


def create_fixed_entities_from_last_month(
    user_id: int, model: type[Expense] | type[Revenue]
) -> list[Expense | Revenue]:
    last_fixed_date = timezone.localdate() + relativedelta(months=11)
    qs = model.objects.filter(
        user_id=user_id,
        created_at__month=last_fixed_date.month,
        created_at__year=last_fixed_date.year,
        is_fixed=True,
    ).values()

    entities: list[model] = []  # type: ignore
    for e in qs:
        del e["id"]
        entities.append(model(created_at=e.pop("created_at") + relativedelta(months=1), **e))

    return model.objects.bulk_create(objs=entities)
