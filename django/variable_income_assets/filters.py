from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.forms import Form

import django_filters

from shared.filters_utils import PeriodFilter

from .choices import (
    AssetObjectives,
    AssetReportsKinds,
    AssetSectors,
    AssetsReportsAggregations,
    AssetStatus,
    AssetTypes,
)
from .models import Asset, AssetReadModel, PassiveIncome, Transaction

if TYPE_CHECKING:  # pragma: no cover
    from django.db.models import QuerySet
    from django.views import View

    from .models.managers import AssetReadModelQuerySet


class CQRSDjangoFilterBackend(django_filters.rest_framework.DjangoFilterBackend):
    def get_filterset_class(self, view: View, _: QuerySet | None = None):
        return view.get_filterset_class()


class AssetFilterSet(django_filters.FilterSet):
    code = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Asset
        exclude = ("user",)


class AssetReadStatusFilterSet(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=AssetStatus.choices, method="filter_status")
    type = django_filters.MultipleChoiceFilter(choices=AssetTypes.choices)

    class Meta:
        model = AssetReadModel
        exclude = ("user",)

    def filter_status(
        self, queryset: AssetReadModelQuerySet[AssetReadModel], _, value: str
    ) -> AssetReadModelQuerySet[AssetReadModel]:
        return queryset.opened() if value == AssetStatus.opened else queryset.closed()


class AssetReadFilterSet(AssetReadStatusFilterSet):
    code = django_filters.CharFilter(lookup_expr="icontains")
    objective = django_filters.MultipleChoiceFilter(choices=AssetObjectives.choices)
    type = django_filters.MultipleChoiceFilter(choices=AssetTypes.choices)
    sector = django_filters.MultipleChoiceFilter(
        choices=AssetSectors.choices,
        field_name="metadata__sector",  # TODO: unable to resolve via repository?
    )
    emergency_fund = django_filters.BooleanFilter(
        method="filter_emergency_fund",
        required=False,
    )

    def filter_emergency_fund(
        self, queryset: AssetReadModelQuerySet[AssetReadModel], _, value: bool
    ) -> AssetReadModelQuerySet[AssetReadModel]:
        return queryset.filter_emergency_fund_assets() if value else queryset


class AssetIndicatorsFilterSet(django_filters.FilterSet):
    include_yield = django_filters.BooleanFilter(required=False)

    class Meta:
        model = AssetReadModel
        fields = []


class AssetFetchCurrentPriceFilterSet(django_filters.FilterSet):
    code = django_filters.MultipleChoiceFilter(choices=[])

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
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class _AssetReportsForm(Form):
    def clean_opened(self):
        opened = self.cleaned_data["opened"]
        if opened is None and AssetReportsKinds.roi == self.cleaned_data["kind"]:
            raise ValidationError("Obrigatório para relatórios ROI")
        return opened

    def clean_closed(self):
        closed = self.cleaned_data["closed"]
        if closed is None and AssetReportsKinds.roi == self.cleaned_data["kind"]:
            raise ValidationError("Obrigatório para relatórios ROI")
        return closed

    def clean_current(self):
        current = self.cleaned_data["current"]
        if current is None and AssetReportsKinds.total_invested == self.cleaned_data["kind"]:
            raise ValidationError("Obrigatório para relatórios de total investido")
        return current

    def clean_percentage(self):
        percentage = self.cleaned_data["percentage"]
        if percentage is None and AssetReportsKinds.total_invested == self.cleaned_data["kind"]:
            raise ValidationError("Obrigatório para relatórios de total investido")
        return percentage


class AssetReportsFilterSet(django_filters.FilterSet):
    kind = django_filters.ChoiceFilter(choices=AssetReportsKinds.choices, required=True)
    opened = django_filters.BooleanFilter(required=False)
    closed = django_filters.BooleanFilter(required=False)
    current = django_filters.BooleanFilter(required=False)
    percentage = django_filters.BooleanFilter(required=False)
    group_by = django_filters.ChoiceFilter(choices=AssetsReportsAggregations.choices, required=True)

    queryset: AssetReadModelQuerySet

    class Meta:
        form = _AssetReportsForm

    @property
    def _roi_qs(self) -> AssetReadModelQuerySet:
        return self.queryset.roi_report(
            opened=self.form.cleaned_data["opened"],
            closed=self.form.cleaned_data["closed"],
            group_by=self.form.cleaned_data["group_by"],
        )

    @property
    def _total_invested_qs(self) -> AssetReadModelQuerySet:
        return self.queryset.total_invested_report(
            group_by=self.form.cleaned_data["group_by"],
            current=self.form.cleaned_data["current"],
        )

    @property
    def qs(self):
        if self.is_valid():
            if self.form.cleaned_data["kind"] == AssetReportsKinds.roi:
                return self._roi_qs

            if not self.form.cleaned_data["percentage"]:
                return self._total_invested_qs
            else:
                # as it's an aggregation, there's not too much entries in `_qs` so it's better to
                # aggregate at python level instead of doing another query
                _qs = list(self._total_invested_qs)
                total_agg = sum(r["total"] for r in _qs)
                return [
                    {
                        **result,
                        "total": (result["total"] / total_agg) * Decimal("100.0"),
                    }
                    for result in _qs
                ]
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class TransactionFilterSet(django_filters.FilterSet):
    asset_code = django_filters.CharFilter(field_name="asset__code", lookup_expr="icontains")
    asset_type = django_filters.MultipleChoiceFilter(
        field_name="asset__type", choices=AssetTypes.choices
    )
    start_date = django_filters.DateFilter(
        field_name="operation_date", lookup_expr="gte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    end_date = django_filters.DateFilter(
        field_name="operation_date", lookup_expr="lte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )

    class Meta:
        model = Transaction
        fields = ("action",)


class PassiveIncomeFilterSet(django_filters.FilterSet):
    asset_code = django_filters.CharFilter(field_name="asset__code", lookup_expr="icontains")
    asset_type = django_filters.ChoiceFilter(field_name="asset__type", choices=AssetTypes.choices)
    start_date = django_filters.DateFilter(
        field_name="operation_date", lookup_expr="gte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    end_date = django_filters.DateFilter(
        field_name="operation_date", lookup_expr="lte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )

    class Meta:
        model = PassiveIncome
        fields = ("type", "event_type")


class DateRangeFilterSet(django_filters.FilterSet):
    start_date = django_filters.DateFilter(
        field_name="operation_date",
        lookup_expr="gte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )
    end_date = django_filters.DateFilter(
        field_name="operation_date",
        lookup_expr="lte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise django_filters.utils.translate_validation(error_dict=self.errors)


class MonthlyDateRangeFilterSet(django_filters.FilterSet):
    start_date = PeriodFilter(
        field_name="operation_date",
        lookup_expr="gte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
    )
    end_date = PeriodFilter(
        field_name="operation_date",
        lookup_expr="lte",
        required=True,
        input_formats=["%d/%m/%Y", "%Y-%m-%d"],
        end=True,
    )
    aggregate_period = django_filters.ChoiceFilter(
        choices=(("month", "month"), ("year", "year")),
        required=False,
        method="filter_aggregate_period",
    )

    def filter_aggregate_period(self, queryset: QuerySet, _: str, __: str) -> QuerySet:
        # The actual aggregation is done in the view based on this filter's value
        # This method just returns the queryset unchanged since date filtering
        # is handled by PeriodFilter based on the aggregate_period value
        return queryset

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise django_filters.utils.translate_validation(error_dict=self.errors)
