from decimal import Decimal

import django_filters as filters

from .choices import AssetTypes
from .models import Asset


class AssetFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")
    type = filters.MultipleChoiceFilter(choices=AssetTypes.choices)
    # ROI_type = filters.ChoiceFilter(
    #     choices=ROYTypeChoices.choices,
    #     method="ROI_type_custom_filter",
    # )

    class Meta:
        model = Asset
        exclude = ("current_price", "user")

    # def ROI_type_custom_filter(self, queryset, _, value) -> QuerySet:
    #     if value:
    #         choice = ROYTypeChoices.get_choice(value=value)
    #         return (
    #             queryset.annotate(
    #                 ROI=Sum(
    #                     (F("transactions__price") - F("transactions__initial_price"))
    #                     * F("transactions__quantity"),
    #                     filter=Q(transactions__action=TransactionActions.sell),
    #                 )
    #             )
    #             .filter(**choice.filter_expression)
    #             .order_by("-ROI")
    #         )

    #     return queryset


class AssetFetchCurrentPriceFilterSet(filters.FilterSet):
    code = filters.MultipleChoiceFilter(choices=[])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.filters["code"].extra["choices"] = [
            (code, code) for code in self.queryset.values_list("code", flat=True)
        ]

    class Meta:
        model = Asset
        fields = ("code",)

    @property
    def qs(self):
        if self.is_valid():
            return super().qs
        raise filters.utils.translate_validation(error_dict=self.errors)


class AssetReportFilterSet(filters.FilterSet):
    percentage = filters.BooleanFilter(required=True)
    current = filters.BooleanFilter(required=True)

    @property
    def qs(self):
        if self.is_valid():
            current = self.form.cleaned_data["current"]
            _qs = self.queryset.report(current=current)

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
