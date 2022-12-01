from decimal import Decimal

from django.forms import Form
from django.core.exceptions import ValidationError

import django_filters as filters

from .choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    AssetsTotalInvestedReportAggregations,
    TransactionActions,
    TransactionCurrencies,
)
from .models import Asset, Transaction


class AssetFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Asset
        exclude = ("current_price", "user")


class AssetFetchCurrentPriceFilterSet(filters.FilterSet):
    code = filters.MultipleChoiceFilter(choices=[])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.filters["code"].extra["choices"] = [
            (code, code) for code in self.queryset.values_list("code", flat=True)
        ]

    class Meta:
        model = Asset
        fields = ("type", "sector", "objective")

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise filters.utils.translate_validation(error_dict=self.errors)


class _AssetTotalInvestedReportForm(Form):
    def clean_percentage(self):
        percentage = self.cleaned_data["percentage"]
        if percentage is None:
            raise ValidationError("Required to define the type of report")
        return percentage

    def clean_current(self):
        current = self.cleaned_data["current"]
        if current is None:
            raise ValidationError("Required to define the type of report")
        return current


class AssetTotalInvestedReportFilterSet(filters.FilterSet):
    percentage = filters.BooleanFilter(required=True)
    current = filters.BooleanFilter(required=True)
    group_by = filters.ChoiceFilter(
        choices=AssetsTotalInvestedReportAggregations.choices, required=True
    )

    class Meta:
        form = _AssetTotalInvestedReportForm

    @property
    def qs(self):
        if self.is_valid():
            current = self.form.cleaned_data["current"]
            _qs = self.queryset.total_invested_report(
                group_by=self.form.cleaned_data["group_by"], current=current
            )
            if self.form.cleaned_data["percentage"]:
                # there's 4 results max in `_qs` so it's better to aggregate at python level
                # instead of doing another query
                _qs = list(_qs)
                total_agg = sum(r["total"] for r in _qs)
                return [
                    {
                        **result,
                        "total": (result["total"] / total_agg) * Decimal("100.0"),
                    }
                    for result in _qs
                ]
            return _qs
        raise filters.utils.translate_validation(error_dict=self.errors)


class _AssetRoiReportForm(Form):
    def clean_opened(self):
        opened = self.cleaned_data["opened"]
        if opened is None:
            raise ValidationError("Required to define the type of assets of the report")
        return opened

    def clean_finished(self):
        finished = self.cleaned_data["finished"]
        if finished is None:
            raise ValidationError("Required to define the type of assets of the report")
        return finished


class AssetRoiReportFilterSet(filters.FilterSet):
    opened = filters.BooleanFilter(required=True)
    finished = filters.BooleanFilter(required=True)

    class Meta:
        form = _AssetRoiReportForm

    @property
    def qs(self):
        if self.is_valid():
            return self.queryset.roi_report(
                opened=self.form.cleaned_data["opened"],
                finished=self.form.cleaned_data["finished"],
            )
        raise filters.utils.translate_validation(error_dict=self.errors)


class TransactionFilterSet(filters.FilterSet):
    asset_code = filters.CharFilter(field_name="asset__code", lookup_expr="icontains")
    start_date = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = ("action",)
