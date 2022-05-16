from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Dict

from django.utils import timezone
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth

from shared.managers_utils import CustomQueryset, MonthlyFilterMixin
from shared.utils import coalesce_sum_expression

from .choices import ExpenseReportType


class _ExpenseFilters:
    def __init__(self, base_date: date = timezone.now().date()) -> None:
        self.base_date = base_date

    @property
    def _current_year(self) -> Q:
        return Q(created_at__month__lte=self.base_date.month, created_at__year=self.base_date.year)

    @property
    def current_month_and_past(self) -> Q:
        return Q(created_at__year__lt=self.base_date.year) | self._current_year

    @property
    def since_a_year_ago(self) -> Q:
        return (
            Q(created_at__month__gte=self.base_date.month, created_at__year=self.base_date.year - 1)
            | self._current_year
        )

    @property
    def current(self) -> Q:
        return Q(created_at__month=self.base_date.month, created_at__year=self.base_date.year)

    @property
    def future(self) -> Q:
        return Q(
            created_at__month__gt=self.base_date.month, created_at__year=self.base_date.year
        ) | Q(created_at__year__gt=self.base_date.year)


class ExpenseQueryset(CustomQueryset, MonthlyFilterMixin):
    filters = _ExpenseFilters()

    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("price")}

    def since_a_year_ago(self) -> ExpenseQueryset:
        return self.filter(self.filters.since_a_year_ago)

    def current_month_and_past(self) -> ExpenseQueryset:
        return self.filter(self.filters.current_month_and_past)

    def report(self, of: str) -> ExpenseQueryset:
        """
        Args:
            of (str): The type of report. For valid choices check ExpenseReportType.choices
        """
        choice = ExpenseReportType.get_choice(value=of)
        return (
            self.values(choice.field_name)
            .annotate(
                total=Sum("price", filter=self.filters.current),
                avg=(
                    coalesce_sum_expression("price", filter=~self.filters.current)
                    / (
                        Count("created_at__month", filter=~self.filters.current, distinct=True)
                        * Decimal("1.0")
                    )
                ),
            )
            .order_by("-total", "-avg")
        )

    def indicators(self):
        return self.aggregate(
            total=coalesce_sum_expression("price", filter=self.filters.current),
            future=coalesce_sum_expression("price", filter=self.filters.future),
            avg=(
                coalesce_sum_expression(
                    "price", filter=self.filters.since_a_year_ago & ~self.filters.current
                )
                / (
                    Count(
                        "created_at__month",
                        filter=self.filters.since_a_year_ago & ~self.filters.current,
                        distinct=True,
                    )
                    * Decimal("1.0")
                )
            ),
        )

    def trunc_months(self) -> ExpenseQueryset:
        return self.annotate(month=TruncMonth("created_at")).values("month").annotate_sum()
