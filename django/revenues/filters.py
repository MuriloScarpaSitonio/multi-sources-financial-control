import django_filters as filters

from .models import Revenue


class RevenueFilterSet(filters.FilterSet):
    start_date = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="created_at", lookup_expr="lte")
    description = filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Revenue
        exclude = ("value",)
