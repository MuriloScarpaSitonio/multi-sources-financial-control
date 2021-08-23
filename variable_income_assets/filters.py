import django_filters as filters

from .models import Asset

"""from django.db.models import F, Q, QuerySet, Sum

from .choices import ROYTypeChoices, TransactionActions"""


class AssetFilterSet(filters.FilterSet):
    code = filters.CharFilter(lookup_expr="icontains")
    """ROI_type = filters.ChoiceFilter(
        choices=ROYTypeChoices.choices,
        method="ROI_type_custom_filter",
    )"""

    class Meta:
        model = Asset
        fields = ("type",)

    """def ROI_type_custom_filter(self, queryset, _, value) -> QuerySet:
        if value:
            choice = ROYTypeChoices.get_choice(value=value)
            return (
                queryset.annotate(
                    ROI=Sum(
                        (F("transactions__price") - F("transactions__initial_price"))
                        * F("transactions__quantity"),
                        filter=Q(transactions__action=TransactionActions.sell),
                    )
                )
                .filter(**choice.filter_expression)
                .order_by("-ROI")
            )

        return queryset"""
