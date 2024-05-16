from django.utils import timezone

from dateutil.relativedelta import relativedelta

from .models import Expense, Revenue


def _create_fixed_entities_from_last_month(
    user_id: int, model: Expense | Revenue
) -> list[Expense | Revenue]:
    one_month_before = timezone.localdate() - relativedelta(months=1)
    qs = model.objects.filter(
        user_id=user_id,
        created_at__month=one_month_before.month,
        created_at__year=one_month_before.year,
        is_fixed=True,
    ).values()

    entities: list[model] = []
    for e in qs:
        del e["id"]
        entities.append(model(created_at=e.pop("created_at") + relativedelta(months=1), **e))

    return model.objects.bulk_create(objs=entities)
