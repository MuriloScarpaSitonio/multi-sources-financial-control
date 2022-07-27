from datetime import date

from django.db.models import Q, QuerySet, Sum
from django.utils import timezone


class SumMixin:
    @staticmethod
    def get_sum_expression(*args, **kwargs) -> Sum:
        raise NotImplementedError()  # pragma: no cover

    def sum(self, *args, **kwargs) -> QuerySet:
        return self.aggregate(**self.get_sum_expression(*args, **kwargs))


class MonthlyFilterMixin:
    def filter_by_month_and_year(self, month: int, year: int) -> QuerySet:
        date_field_name = getattr(self, "date_field_name", "created_at")
        return self.filter(
            **{
                f"{date_field_name}__month": month,
                f"{date_field_name}__year": year,
            }
        )


class CustomQueryset(QuerySet, SumMixin):
    def annotate_sum(self, *args, **kwargs) -> QuerySet:
        sum_expression = self.get_sum_expression(*args, **kwargs)
        return self.annotate(**sum_expression).order_by(f"-{list(sum_expression)[0]}")

    def aggregate_field(self, field_name: str, *args, **kwargs) -> QuerySet:
        return self.values(field_name).annotate_sum(*args, **kwargs)


class GenericFilters:
    def __init__(self, date_field_name: str, base_date: date = timezone.now().date()) -> None:
        self.date_field_name = date_field_name
        self.base_date = base_date

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
        return (
            Q(
                **{
                    f"{self.date_field_name}__month__gt": self.base_date.month,
                    f"{self.date_field_name}__year": self.base_date.year,
                }
            )
            | Q(**{f"{self.date_field_name}__year__gt": self.base_date.year})
        )
