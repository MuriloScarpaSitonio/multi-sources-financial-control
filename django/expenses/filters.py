from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.forms import Form

import django_filters as filters

from .choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from .models import Expense, Revenue

if TYPE_CHECKING:
    from .managers import ExpenseQueryset


class _PersonalFinanceFilterSet(filters.FilterSet):
    start_date = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="created_at", lookup_expr="lte")
    description = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        fields = ("is_fixed",)

    @property
    def qs(self):
        _qs = super().qs
        return _qs.order_by("created_at") if self.form.cleaned_data["start_date"] else _qs


class ExpenseFilterSet(_PersonalFinanceFilterSet):
    category = filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)
    source = filters.MultipleChoiceFilter(choices=ExpenseSource.choices)

    class Meta(_PersonalFinanceFilterSet.Meta):
        model = Expense


class RevenueFilterSet(_PersonalFinanceFilterSet):
    class Meta(_PersonalFinanceFilterSet.Meta):
        model = Revenue


class ExpenseAvgComparasionReportFilterSet(filters.FilterSet):
    group_by = filters.ChoiceFilter(
        choices=ExpenseReportType.choices, required=True, method="reports"
    )
    period = filters.ChoiceFilter(
        choices=(
            ("since_a_year_ago", "since_a_year_ago"),
            ("current_month_and_past", "current_month_and_past"),
        ),
        required=True,
        method="filter_period",
    )

    def reports(self, queryset: ExpenseQueryset, _: str, value: bool):
        return queryset.avg_comparasion_report(group_by=value)

    def filter_period(self, queryset: ExpenseQueryset, _: str, value: str):
        return getattr(queryset, value)()

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise filters.utils.translate_validation(error_dict=self.errors)


class ExpensePercentageReportFilterSet(filters.FilterSet):
    group_by = filters.ChoiceFilter(choices=ExpenseReportType.choices, required=True)
    period = filters.ChoiceFilter(
        choices=(
            ("since_a_year_ago", "since_a_year_ago"),
            ("current_month_and_past", "current_month_and_past"),
            ("current", "current"),
        ),
        required=True,
    )

    queryset: ExpenseQueryset

    @property
    def qs(self):
        if self.is_valid():
            _qs = list(
                self.queryset.percentage_report(
                    group_by=self.form.cleaned_data["group_by"],
                    period=self.form.cleaned_data["period"],
                )
            )

            total_agg = sum(r["total"] for r in _qs)
            return [
                {
                    **result,
                    "total": (result["total"] / total_agg) * Decimal("100.0"),
                }
                for result in _qs
            ]
        raise filters.utils.translate_validation(error_dict=self.errors)


class ExpenseHistoricFilterSet(filters.FilterSet):
    future = filters.BooleanFilter(method="filter_future", required=True)
    category = filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)

    def filter_future(self, queryset: ExpenseQueryset, _: str, value: bool):
        return queryset.future() if value else queryset.since_a_year_ago()


class RevenueHistoricFilterSet(filters.FilterSet):
    is_fixed = filters.BooleanFilter()

    @property
    def qs(self):
        return super().qs.since_a_year_ago()
