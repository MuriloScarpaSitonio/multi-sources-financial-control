from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Self

from django.db.models import CharField, Count, DecimalField, Q, QuerySet, Sum
from django.db.models.functions import Cast, Coalesce, Concat, TruncMonth

from shared.managers_utils import GenericDateFilters

from .choices import ExpenseReportType

if TYPE_CHECKING:
    from django.db.models.expressions import CombinedExpression


class _PersonalFinancialDateFilters(GenericDateFilters):
    def __init__(self) -> None:
        super().__init__(date_field_name="created_at")

    @property
    def current_month_and_past(self) -> Q:
        return Q(created_at__year__lt=self.base_date.year) | self._current_year


class _PersonalFinancialQuerySet(QuerySet):
    filters = _PersonalFinancialDateFilters()

    @property
    def _monthly_avg_expression(self) -> CombinedExpression:
        return Sum(
            "value", filter=self.filters.since_a_year_ago & ~self.filters.current, default=Decimal()
        ) / (
            Count(
                Concat("created_at__month", "created_at__year", output_field=CharField()),
                filter=self.filters.since_a_year_ago & ~self.filters.current,
                distinct=True,
            )
            * Cast(1.0, DecimalField())
        )

    def since_a_year_ago(self) -> Self:
        return self.filter(self.filters.since_a_year_ago)

    def current_month_and_past(self) -> Self:
        return self.filter(self.filters.current_month_and_past)

    def future(self) -> Self:
        return self.filter(self.filters.future)

    def monthly_avg(self) -> dict[str, Decimal]:
        return self.aggregate(avg=Coalesce(self._monthly_avg_expression, Decimal()))

    def trunc_months(self) -> Self:
        return (
            self.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("value"))
            .order_by("-total")
        )

    def sum(self) -> dict[str, Decimal]:
        return self.aggregate(total=Coalesce(Sum("value"), Decimal()))


class ExpenseQueryset(_PersonalFinancialQuerySet):
    def report(self, kind: str) -> Self:
        """
        Args:
            of (str): The type of report. For valid choices check ExpenseReportType.choices
        """
        choice = ExpenseReportType.get_choice(value=kind)
        return (
            self.values(choice.field_name)
            .annotate(
                total=Sum("value", filter=self.filters.current, default=Decimal()),
                avg=(
                    Sum("value", filter=~self.filters.current, default=Decimal())
                    / (
                        # we are dividing by the amount of months a given aggregation appears.
                        # in order to divide for the whole period we should compute some subquery
                        # like self.values("created_at__month").distinct().order_by().count()
                        Count(
                            Concat(
                                "created_at__month", "created_at__year", output_field=CharField()
                            ),
                            filter=~self.filters.current,
                            distinct=True,
                        )
                        * Cast(1.0, DecimalField())
                    )
                ),
            )
            .order_by("-total", "-avg")
        )

    def indicators(self) -> dict[str, Decimal]:
        return self.aggregate(
            total=Sum("value", filter=self.filters.current, default=Decimal()),
            future=Sum("value", filter=self.filters.future, default=Decimal()),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )


class RevenueQueryset(_PersonalFinancialQuerySet):
    def indicators(self) -> dict[str, Decimal]:
        return self.aggregate(
            total=Sum("value", filter=self.filters.current, default=Decimal()),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )
