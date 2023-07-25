from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

import django_filters as filters
from django.core.exceptions import ValidationError
from django.forms import Form

from .choices import AssetsTotalInvestedReportAggregations, AssetTypes
from .models import Asset, AssetReadModel, PassiveIncome, Transaction

if TYPE_CHECKING:  # pragma: no cover
    from django.db.models import QuerySet
    from django.views import View


class CQRSDjangoFilterBackend(filters.rest_framework.DjangoFilterBackend):
    def get_filterset_class(self, view: View, _: QuerySet | None = None):
        return view.get_filterset_class()


class AssetFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Asset
        exclude = ("user",)


class AssetReadFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")
    sector = filters.CharFilter(
        field_name="metadata__sector"  # TODO: unable to resolve via repository?
    )

    class Meta:
        model = AssetReadModel
        exclude = ("user",)


class AssetFetchCurrentPriceFilterSet(filters.FilterSet):
    code = filters.MultipleChoiceFilter(choices=[])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.filters["code"].extra["choices"] = [
            (code, code) for code in self.queryset.values_list("code", flat=True)
        ]

    class Meta:
        model = Asset
        fields = ("type", "objective")

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
    asset_type = filters.ChoiceFilter(field_name="asset__type", choices=AssetTypes.choices)
    start_date = filters.DateFilter(field_name="operation_date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="operation_date", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = ("action",)


class PassiveIncomeFilterSet(filters.FilterSet):
    asset_code = filters.CharFilter(field_name="asset__code", lookup_expr="icontains")
    asset_type = filters.ChoiceFilter(field_name="asset__type", choices=AssetTypes.choices)
    start_date = filters.DateFilter(field_name="operation_date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="operation_date", lookup_expr="lte")

    class Meta:
        model = PassiveIncome
        fields = ("type", "event_type")


class PassiveIncomeAssetsAgreggationReportFilterSet(filters.FilterSet):
    all = filters.BooleanFilter()
    credited = filters.BooleanFilter()
    provisioned = filters.BooleanFilter()

    @property
    def qs(self):
        if self.is_valid():
            # if self.form.cleaned_data["all"] == {
            #     "all": False,
            #     "credited": True,
            #     "provisioned": True,
            # }:
            #    TODO
            #    special case when only `credited` incomes should be filtered by `since_a_year_ago`
            _qs = (
                self.queryset if self.form.cleaned_data["all"] else self.queryset.since_a_year_ago()
            )
            return _qs.assets_aggregation(
                credited=self.form.cleaned_data["credited"],
                provisioned=self.form.cleaned_data["provisioned"],
            )
        raise filters.utils.translate_validation(error_dict=self.errors)
