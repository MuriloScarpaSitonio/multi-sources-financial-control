from __future__ import annotations

from typing import TYPE_CHECKING

import django_filters
from dateutil.relativedelta import relativedelta

if TYPE_CHECKING:
    from datetime import date

    from django.db.models import QuerySet


class MonthFilter(django_filters.DateFilter):
    def __init__(self, **kwargs):
        self.end = kwargs.pop("end", False)
        super().__init__(**kwargs)

    def filter(self, qs: QuerySet, value: date | None) -> QuerySet:
        if not value:
            return qs
        if self.distinct:
            qs = qs.distinct()

        lookup = f"{self.field_name}__{self.lookup_expr}"
        return self.get_method(qs)(
            **{lookup: value + relativedelta(day=31) if self.end else value.replace(day=1)}
        )


class PeriodFilter(django_filters.DateFilter):
    def __init__(self, **kwargs):
        self.end = kwargs.pop("end", False)
        self.period_field = kwargs.pop("period_field", "aggregate_period")
        super().__init__(**kwargs)

    def filter(self, qs: QuerySet, value: date | None) -> QuerySet:
        if not value:
            return qs
        if self.distinct:
            qs = qs.distinct()

        # Get the aggregate_period value from the filterset data
        period = self.parent.data.get(self.period_field, "month")

        if period == "year":
            # Filter by entire years. End of year: December 31st. Start of year: January 1st
            filtered_date = (
                value.replace(month=12, day=31) if self.end else value.replace(month=1, day=1)
            )
        else:
            # Filter by entire months (default behavior)
            filtered_date = value + relativedelta(day=31) if self.end else value.replace(day=1)

        lookup = f"{self.field_name}__{self.lookup_expr}"
        return self.get_method(qs)(**{lookup: filtered_date})
