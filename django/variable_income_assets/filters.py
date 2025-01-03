from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.forms import Form

import django_filters as filters

from .choices import (
    AssetObjectives,
    AssetReportsKinds,
    AssetSectors,
    AssetsReportsAggregations,
    AssetStatus,
    AssetTypes,
)
from .models import (
    Asset,
    AssetReadModel,
    AssetsTotalInvestedSnapshot,
    PassiveIncome,
    Transaction,
)

if TYPE_CHECKING:  # pragma: no cover
    from django.db.models import QuerySet
    from django.views import View

    from .models.managers import AssetReadModelQuerySet


class CQRSDjangoFilterBackend(filters.rest_framework.DjangoFilterBackend):
    def get_filterset_class(self, view: View, _: QuerySet | None = None):
        return view.get_filterset_class()


class AssetFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Asset
        exclude = ("user",)


class AssetReadStatusFilterSet(filters.FilterSet):
    status = filters.ChoiceFilter(choices=AssetStatus.choices, method="filter_status")

    class Meta:
        model = AssetReadModel
        exclude = ("user",)

    def filter_status(
        self, queryset: AssetReadModelQuerySet[AssetReadModel], _, value: str
    ) -> AssetReadModelQuerySet[AssetReadModel]:
        return queryset.opened() if value == AssetStatus.opened else queryset.closed()


class AssetReadFilterSet(AssetReadStatusFilterSet):
    code = filters.CharFilter(lookup_expr="icontains")
    objective = filters.MultipleChoiceFilter(choices=AssetObjectives.choices)
    type = filters.MultipleChoiceFilter(choices=AssetTypes.choices)
    sector = filters.MultipleChoiceFilter(
        choices=AssetSectors.choices,
        field_name="metadata__sector",  # TODO: unable to resolve via repository?
    )


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


class AssetReportsFilterSet(filters.FilterSet):
    kind = filters.ChoiceFilter(choices=AssetReportsKinds.choices, required=True)
    opened = filters.BooleanFilter(required=False)
    closed = filters.BooleanFilter(required=False)
    current = filters.BooleanFilter(required=False)
    percentage = filters.BooleanFilter(required=False)
    group_by = filters.ChoiceFilter(choices=AssetsReportsAggregations.choices, required=True)

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
    start_date = filters.DateFilter(
        field_name="operation_date", lookup_expr="gte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    end_date = filters.DateFilter(
        field_name="operation_date", lookup_expr="lte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )

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


class AssetsTotalInvestedSnapshotFilterSet(filters.FilterSet):
    start_date = filters.DateFilter(
        field_name="operation_date", lookup_expr="gte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )
    end_date = filters.DateFilter(
        field_name="operation_date", lookup_expr="lte", input_formats=["%d/%m/%Y", "%Y-%m-%d"]
    )

    class Meta:
        model = AssetsTotalInvestedSnapshot
        fields = ()
