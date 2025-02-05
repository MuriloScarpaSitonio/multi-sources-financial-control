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
