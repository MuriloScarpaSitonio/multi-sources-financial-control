from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Literal, Self

from django.db.models import CharField, Count, DecimalField, F, Q, QuerySet, Sum
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

    def since_a_year_ago_avg(self) -> dict[str, Decimal]:
        return (
            self.filter(self.filters.since_a_year_ago)
            .exclude(self.filters.current)
            .aggregate(
                avg=Coalesce(
                    Sum("value", default=Decimal())
                    / (
                        Count(
                            Concat(
                                "created_at__month", "created_at__year", output_field=CharField()
                            ),
                            distinct=True,
                        )
                        * Cast(1.0, DecimalField())
                    ),
                    Decimal(),
                ),
            )
        )

    def current_month_and_past(self) -> Self:
        return self.filter(self.filters.current_month_and_past)

    def current_month(self) -> Self:
        return self.filter(self.filters.current)

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

    def annotate_num_of_appearances(self, field_name: str) -> Self:
        return self.values(field_name).annotate(num_of_appearances=Count(field_name))

    def as_related_entities(self, field_name: str) -> Self:
        kwargs = {"name": F(field_name)}
        if field_name == "category":
            qs = self.annotate(
                id=F("expanded_category_id"), hex_color=F("expanded_category__hex_color"), **kwargs
            )
        elif field_name == "source":
            qs = self.annotate(
                id=F("expanded_source_id"), hex_color=F("expanded_source__hex_color"), **kwargs
            )

        return qs.values("id", "name", "hex_color").distinct()

    def most_common(self, field_name: str) -> str:
        return self.annotate_num_of_appearances(field_name).order_by("-num_of_appearances")


class ExpenseQueryset(_PersonalFinancialQuerySet):
    def percentage_report(self, group_by: str, start_date: date, end_date: date) -> Self:
        choice = ExpenseReportType.get_choice(value=group_by)
        return (
            self.values(choice.field_name)
            .annotate(
                total=Sum(
                    "value",
                    filter=self.filters.filter_range(start_date, end_date),
                    default=Decimal(),
                )
            )
            .filter(total__gt=0)
            .order_by("-total")
        )

    def avg_comparasion_report(self, group_by: str) -> Self:
        choice = ExpenseReportType.get_choice(value=group_by)
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

    def annotate_num_of_appearances(self, field_name: Literal["category", "source"]) -> Self:
        return super().annotate_num_of_appearances(field_name)

    def as_related_entities(self, field_name: Literal["category", "source"]) -> Self:
        return super().as_related_entities(field_name)

    def most_common(self, field_name: Literal["category", "source"]) -> str:
        return super().most_common(field_name)


class RevenueQueryset(_PersonalFinancialQuerySet):
    def indicators(self) -> dict[str, Decimal]:
        return self.aggregate(
            total=Sum("value", filter=self.filters.current, default=Decimal()),
            avg=Coalesce(self._monthly_avg_expression, Decimal()),
        )

    def annotate_num_of_appearances(self, _: str = "") -> Self:
        return super().annotate_num_of_appearances(field_name="category")

    def as_related_entities(self) -> Self:
        return super().as_related_entities(field_name="category")

    def most_common(self) -> str:
        return super().most_common(field_name="category")

    def percentage_report(self, start_date: date, end_date: date) -> Self:
        return (
            self.values("category")
            .annotate(
                total=Sum(
                    "value",
                    filter=self.filters.filter_range(start_date, end_date),
                    default=Decimal(),
                )
            )
            .filter(total__gt=0)
            .order_by("-total")
        )
