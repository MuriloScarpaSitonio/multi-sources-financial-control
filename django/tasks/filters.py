import django_filters as filters
from django.db.models import F, Q

from .models import TaskHistory, TaskHistoryQuerySet


class TaskHistoryFilterSet(filters.FilterSet):
    notified = filters.BooleanFilter(method="filter_notified")

    class Meta:
        model = TaskHistory
        exclude = ("value",)

    def filter_notified(
        self, queryset: TaskHistoryQuerySet[TaskHistory], _, value: bool
    ) -> TaskHistoryQuerySet[TaskHistory]:
        query = Q()
        if value is True:
            lookup = "lte"
            filters_ = []
        else:
            lookup = "gte"
            filters_ = [{"notified_at__isnull": True}]

        filters_.append({f"updated_at__{lookup}": F("notified_at")})
        for f in filters_:
            query |= Q(**f)

        return queryset.filter(query)
