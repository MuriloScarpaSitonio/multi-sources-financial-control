from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

import django_filters
from dateutil.relativedelta import relativedelta
from rest_framework.filters import OrderingFilter

from .choices import ExpenseReportType
from .models import Expense, Revenue

if TYPE_CHECKING:
    from datetime import date

    from django.db.models import QuerySet

    from rest_framework.request import Request
    from rest_framework.viewsets import GenericViewSet

    from .managers import ExpenseQueryset, RevenueQueryset


class MostCommonOrderingFilterBackend(OrderingFilter):
    def filter_queryset(
        self, request: Request, queryset: QuerySet, view: GenericViewSet
    ) -> QuerySet:
        ordering = self.get_ordering(request, queryset, view)
        if ordering:
            if "num_of_appearances" in ordering or "-num_of_appearances" in ordering:
                args = (view.expense_field,) if hasattr(view, "expense_field") else ()
                return (
                    view.get_related_queryset()
                    .annotate_num_of_appearances(*args)
                    .as_related_entities(*args)
                    .order_by(*ordering)
                )

            return queryset.order_by(*ordering)

        return queryset


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
    category = django_filters.CharFilter(method="filter_category")
    source = django_filters.CharFilter(method="filter_source")
    with_installments = django_filters.BooleanFilter(method="filter_with_installments")

    class Meta(_PersonalFinanceFilterSet.Meta):
        model = Expense

    def filter_with_installments(
        self, queryset: ExpenseQueryset, _: str, value: bool
    ) -> ExpenseQueryset:
        return queryset.filter(installments_id__isnull=not value)

    def filter_category(self, queryset: ExpenseQueryset, *_, **__) -> ExpenseQueryset:
        return queryset.filter(category__in=self.request.GET.getlist("category"))

    def filter_source(self, queryset: ExpenseQueryset, *_, **__) -> ExpenseQueryset:
        return queryset.filter(source__in=self.request.GET.getlist("source"))


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


class ExpenseHistoricFilterSet(django_filters.FilterSet):
    future = django_filters.BooleanFilter(method="filter_future", required=True)
    category = django_filters.CharFilter()

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


class ExpensePercentageReportFilterSet(PersonalFinanceIndicatorsV2FilterSet):
    group_by = django_filters.ChoiceFilter(choices=ExpenseReportType.choices, required=True)

    queryset: ExpenseQueryset

    @property
    def qs(self):
        if self.is_valid():
            _qs = list(
                self.queryset.percentage_report(
                    group_by=self.form.cleaned_data["group_by"],
                    start_date=self.form.cleaned_data["start_date"],
                    end_date=self.form.cleaned_data["end_date"],
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


class RevenueHistoricFilterSet(django_filters.FilterSet):
    is_fixed = django_filters.BooleanFilter()

    @property
    def qs(self):
        return super().qs.since_a_year_ago()


class RevenuesPercentageReportFilterSet(PersonalFinanceIndicatorsV2FilterSet):
    queryset: RevenueQueryset

    @property
    def qs(self):
        if self.is_valid():
            _qs = list(
                self.queryset.percentage_report(
                    start_date=self.form.cleaned_data["start_date"],
                    end_date=self.form.cleaned_data["end_date"],
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


class PersonalFinanceContextFilterSet(django_filters.FilterSet):
    perform_actions_on_future_fixed_entities = django_filters.BooleanFilter(required=False)

    def get_cleaned_data(self) -> dict:
        if self.is_valid():
            if cleaned_data := self.form.cleaned_data:
                return cleaned_data
            return {"perform_actions_on_future_fixed_entities": False}
        raise django_filters.utils.translate_validation(error_dict=self.errors)
