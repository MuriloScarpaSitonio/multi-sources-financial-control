from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Dict

from django.db.models import Count, Q, Sum, CharField
from django.db.models.expressions import CombinedExpression
from django.db.models.functions import Concat, TruncMonth

from shared.managers_utils import CustomQueryset, GenericFilters, MonthlyFilterMixin
from shared.utils import coalesce_sum_expression

from .choices import ExpenseReportType


class _ExpenseFilters(GenericFilters):
    def __init__(self) -> None:
        super().__init__(date_field_name="created_at")

    @property
    def current_month_and_past(self) -> Q:
        return Q(created_at__year__lt=self.base_date.year) | self._current_year


class ExpenseQueryset(CustomQueryset, MonthlyFilterMixin):
    filters = _ExpenseFilters()

    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("price")}

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return coalesce_sum_expression(
            "price", filter=self.filters.since_a_year_ago & ~self.filters.current
        ) / (
            Count(
                Concat("created_at__month", "created_at__year", output_field=CharField()),
                filter=self.filters.since_a_year_ago & ~self.filters.current,
                distinct=True,
            )
            * Decimal("1.0")
        )

    def since_a_year_ago(self) -> ExpenseQueryset:
        return self.filter(self.filters.since_a_year_ago)

    def current_month_and_past(self) -> ExpenseQueryset:
        return self.filter(self.filters.current_month_and_past)

    def future(self) -> ExpenseQueryset:
        return self.filter(self.filters.future)

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
                        # we are dividing by the amount of months a given aggregation appears.
                        # in order to divide for the whole period we should compute some subquery like
                        # self.values("created_at__month").distinct().order_by().count()
                        Count(
                            Concat(
                                "created_at__month", "created_at__year", output_field=CharField()
                            ),
                            filter=~self.filters.current,
                            distinct=True,
                        )
                        * Decimal("1.0")
                    )
                ),
            )
            .order_by("-total", "-avg")
        )

    def indicators(self) -> Dict[str, Decimal]:
        return self.aggregate(
            total=coalesce_sum_expression("price", filter=self.filters.current),
            future=coalesce_sum_expression("price", filter=self.filters.future),
            avg=self._monthly_avg_expression,
        )

    def monthly_avg(self) -> Dict[str, Decimal]:
        return self.aggregate(avg=self._monthly_avg_expression)

    def trunc_months(self) -> ExpenseQueryset:
        return self.annotate(month=TruncMonth("created_at")).values("month").annotate_sum()
