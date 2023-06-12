from datetime import date

from django.db.models import Q
from django.utils import timezone


class GenericDateFilters:
    def __init__(self, date_field_name: str, base_date: date | None = None) -> None:
        self.date_field_name = date_field_name
        self.base_date = base_date if base_date is not None else timezone.localdate()

    @property
    def _current_year(self) -> Q:
        return Q(
            **{
                f"{self.date_field_name}__month__lte": self.base_date.month,
                f"{self.date_field_name}__year": self.base_date.year,
            }
        )

    @property
    def since_a_year_ago(self) -> Q:
        return (
            Q(
                **{
                    f"{self.date_field_name}__month__gte": self.base_date.month,
                    f"{self.date_field_name}__year": self.base_date.year - 1,
                }
            )
            | self._current_year
        )

    @property
    def current(self) -> Q:
        return Q(
            **{
                f"{self.date_field_name}__month": self.base_date.month,
                f"{self.date_field_name}__year": self.base_date.year,
            }
        )

    @property
    def future(self) -> Q:
        return Q(
            **{
                f"{self.date_field_name}__month__gt": self.base_date.month,
                f"{self.date_field_name}__year": self.base_date.year,
            }
        ) | Q(**{f"{self.date_field_name}__year__gt": self.base_date.year})
