from datetime import datetime

import django_filters as filters
from django.forms import Form
from django.core.exceptions import ValidationError

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


class _ExpenseReportForm(Form):
    def clean_month(self):
        month = self.cleaned_data["month"]
        if month is not None and (
            month < datetime.min.month or month > datetime.max.month
        ):
            raise ValidationError("Out of range")
        return month

    def clean_year(self):
        year = self.cleaned_data["year"]
        if year is not None and (year < datetime.min.year or year > datetime.max.year):
            raise ValidationError("Out of range")
        return year

    def clean_of(self):
        of = self.cleaned_data["of"]
        if not of:
            raise ValidationError("Required to define the type of report")
        return of


class ExpenseReportFilterSet(filters.FilterSet):
    month = filters.NumberFilter()
    year = filters.NumberFilter()
    of = filters.ChoiceFilter(choices=ExpenseReportType.choices)

    class Meta:
        form = _ExpenseReportForm

    @property
    def qs(self):
        _qs = self.queryset.all()
        if self.is_valid():
            month = self.form.cleaned_data["month"]
            year = self.form.cleaned_data["year"]
            if month is not None and year is not None:
                _qs = _qs.filter_by_month_and_year(month=month, year=year)
            return _qs.report(of=self.form.cleaned_data["of"])
        raise filters.utils.translate_validation(error_dict=self.errors)
