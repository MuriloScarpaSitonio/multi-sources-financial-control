import django_filters as filters

from .choices import ExpenseCategory, ExpenseReportType, ExpenseSource
from .models import Expense


class ExpenseFilterSet(filters.FilterSet):
    start_date = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="created_at", lookup_expr="lte")
    description = filters.CharFilter(lookup_expr="icontains")
    category = filters.MultipleChoiceFilter(choices=ExpenseCategory.choices)
    source = filters.MultipleChoiceFilter(choices=ExpenseSource.choices)

    class Meta:
        model = Expense
        fields = ("is_fixed",)


class ExpenseReportFilterSet(filters.FilterSet):
    of = filters.ChoiceFilter(choices=ExpenseReportType.choices, required=True)
    all = filters.BooleanFilter()

    @property
    def qs(self):
        if self.is_valid():
            _qs = (
                self.queryset.current_month_and_past()
                if self.form.cleaned_data["all"]
                else self.queryset.since_a_year_ago()
            )
            return _qs.report(of=self.form.cleaned_data["of"])
        raise filters.utils.translate_validation(error_dict=self.errors)


class ExpenseHistoricFilterSet(filters.FilterSet):
    future = filters.BooleanFilter()

    @property
    def qs(self):
        if self.is_valid():
            return (
                self.queryset.future()
                if self.form.cleaned_data["future"]
                else self.queryset.since_a_year_ago()
            )
        raise filters.utils.translate_validation(error_dict=self.errors)
