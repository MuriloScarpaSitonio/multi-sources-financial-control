from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

import django_filters
from dateutil.relativedelta import relativedelta

from .choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from .models import Expense, Revenue

if TYPE_CHECKING:
    from datetime import date

    from django.db.models import QuerySet

    from .managers import ExpenseQueryset


class _PersonalFinanceFilterSet(django_filters.FilterSet):
    start_date = django_filters.DateFilter(
        field_name="created_at", lookup_expr="gte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    end_date = django_filters.DateFilter(
        field_name="created_at", lookup_expr="lte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    description = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        fields = ("is_fixed",)

    @property
    def qs(self):
        _qs = super().qs
        return _qs.order_by("created_at") if self.form.cleaned_data["start_date"] else _qs


class ExpenseFilterSet(_PersonalFinanceFilterSet):
    category = django_filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)
    source = django_filters.MultipleChoiceFilter(choices=ExpenseSource.choices)
    with_installments = django_filters.BooleanFilter(method="filter_with_installments")

    class Meta(_PersonalFinanceFilterSet.Meta):
        model = Expense

    def filter_with_installments(
        self, queryset: ExpenseQueryset, _: str, value: bool
    ) -> ExpenseQueryset:
        return queryset.filter(installments_id__isnull=not value)


class RevenueFilterSet(_PersonalFinanceFilterSet):
    class Meta(_PersonalFinanceFilterSet.Meta):
        model = Revenue


class ExpenseAvgComparasionReportFilterSet(django_filters.FilterSet):
    group_by = django_filters.ChoiceFilter(
        choices=ExpenseReportType.choices, required=True, method="reports"
    )
    period = django_filters.ChoiceFilter(
        choices=(
            ("since_a_year_ago", "since_a_year_ago"),
            ("current_month_and_past", "current_month_and_past"),
        ),
        required=True,
        method="filter_period",
    )

    def reports(self, queryset: ExpenseQueryset, _: str, value: bool) -> ExpenseQueryset:
        return queryset.avg_comparasion_report(group_by=value)

    def filter_period(self, queryset: ExpenseQueryset, _: str, value: str) -> ExpenseQueryset:
        return getattr(queryset, value)()

    @property
    def qs(self) -> ExpenseQueryset:
        if self.is_valid():
            return super().qs
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class ExpensePercentageReportFilterSet(django_filters.FilterSet):
    group_by = django_filters.ChoiceFilter(choices=ExpenseReportType.choices, required=True)
    period = django_filters.ChoiceFilter(
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
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class ExpenseHistoricFilterSet(django_filters.FilterSet):
    future = django_filters.BooleanFilter(method="filter_future", required=True)
    category = django_filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)

    def filter_future(self, queryset: ExpenseQueryset, _: str, value: bool):
        return queryset.future() if value else queryset.since_a_year_ago()


class MonthFilter(django_filters.DateFilter):
    def __init__(self, **kwargs):
        self.end = kwargs.pop("end", False)
        super().__init__(**kwargs)

    def filter(self, qs: QuerySet, value: date | None) -> QuerySet:
        if not value:
            return qs
        if self.distinct:
            qs = qs.distinct()

        lookup = f"{self.field_name}__{self.lookup_expr}"
        return self.get_method(qs)(
            **{lookup: value + relativedelta(day=31) if self.end else value.replace(day=1)}
        )


class ExpenseHistoricV2FilterSet(django_filters.FilterSet):
    start_date = MonthFilter(
        field_name="created_at",
        lookup_expr="gte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )
    end_date = MonthFilter(
        field_name="created_at",
        lookup_expr="lte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
        end=True,
    )

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class PersonalFinanceIndicatorsV2FilterSet(django_filters.FilterSet):
    start_date = django_filters.DateFilter(
        field_name="created_at",
        lookup_expr="gte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )
    end_date = django_filters.DateFilter(
        field_name="created_at",
        lookup_expr="lte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class RevenueHistoricFilterSet(django_filters.FilterSet):
    is_fixed = django_filters.BooleanFilter()

    @property
    def qs(self):
        return super().qs.since_a_year_ago()


class PersonalFinanceContextFilterSet(django_filters.FilterSet):
    perform_actions_on_future_fixed_expenses = django_filters.BooleanFilter(required=False)

    def get_cleaned_data(self) -> dict:
        if self.is_valid():
            if cleaned_data := self.form.cleaned_data:
                return cleaned_data
            return {"perform_actions_on_future_fixed_expenses": False}
        raise django_filters.utils.translate_validation(error_dict=self.errors)
