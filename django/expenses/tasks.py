from django.utils import timezone

from dateutil.relativedelta import relativedelta

from .models import Expense


# TODO: run this every 1st of month for every users
def create_fixed_expenses_from_last_month(user_id: int) -> list[Expense]:
    one_month_before = timezone.localdate() - relativedelta(months=1)
    qs = Expense.objects.filter(
        user_id=user_id,
        created_at__month=one_month_before.month,
        created_at__year=one_month_before.year,
        is_fixed=True,
    ).values()

    expenses: list[Expense] = []
    for e in qs:
        del e["id"]
        expenses.append(Expense(created_at=e.pop("created_at") + relativedelta(months=1), **e))

    return Expense.objects.bulk_create(objs=expenses)
