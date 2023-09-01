import django_filters as filters

from .choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from .models import Expense, Revenue


class _PersonalFinanceFilterSet(filters.FilterSet):
    start_date = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="created_at", lookup_expr="lte")
    description = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Expense
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


class ExpenseReportFilterSet(filters.FilterSet):
    kind = filters.ChoiceFilter(
        choices=ExpenseReportType.choices, required=True, method="filter_kind"
    )
    all = filters.BooleanFilter(method="filter_all")

    def filter_kind(self, queryset, _: str, value: bool):
        return queryset.report(kind=value)

    def filter_all(self, queryset, _: str, value: bool):
        return queryset.current_month_and_past() if value else queryset.since_a_year_ago()

    @property
    def qs(self):
        if self.is_valid():
            _qs = super().qs
            if self.form.cleaned_data["all"] is None:
                _qs = _qs.since_a_year_ago()
            return _qs
        raise filters.utils.translate_validation(error_dict=self.errors)


class ExpenseHistoricFilterSet(filters.FilterSet):
    future = filters.BooleanFilter(method="filter_future", required=True)
    category = filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)

    def filter_future(self, queryset, _: str, value: bool):
        return queryset.future() if value else queryset.since_a_year_ago()


class RevenueHistoricFilterSet(filters.FilterSet):
    is_fixed = filters.BooleanFilter()

    @property
    def qs(self):
        return super().qs.since_a_year_ago()
