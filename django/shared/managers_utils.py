from django.utils import timezone
from django.db.models import F, Q, QuerySet, Sum, Window
from django.db.models.functions import Lag, TruncMonth


class SumMixin:
    @staticmethod
    def get_sum_expression(*args, **kwargs) -> Sum:
        raise NotImplementedError()  # pragma: no cover

    def sum(self, *args, **kwargs) -> QuerySet:
        return self.aggregate(**self.get_sum_expression(*args, **kwargs))


class IndicatorsMixin:
    def indicators(self) -> QuerySet:
        today = timezone.now().date()

        if today.month == 1:
            last_month = 12
            year = today.year - 1
        else:
            last_month = today.month - 1
            year = today.year
        return (
            self.filter(
                Q(
                    created_at__month=today.month,
                    created_at__year=today.year,
                )
                | Q(
                    created_at__month=last_month,
                    created_at__year=year,
                )
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate_sum()
            .annotate(diff=F("total") - Window(expression=Lag("total")))
            .annotate(
                diff_percentage=(
                    (
                        (
                            (Window(expression=Lag("total")) + F("diff"))
                            / Window(expression=Lag("total"))
                        )
                        - 1
                    )
                    * 100
                )
            )
            .order_by("-diff")
        )


class MonthlyFilterMixin:
    def filter_by_month_and_year(self, month: int, year: int) -> QuerySet:
        return self.filter(created_at__month=month, created_at__year=year)


class CustomQueryset(QuerySet, SumMixin):
    def annotate_sum(self, *args, **kwargs) -> QuerySet:
        sum_expression = self.get_sum_expression(*args, **kwargs)
        return self.annotate(**sum_expression).order_by(f"-{list(sum_expression)[0]}")

    def aggregate_field(self, field_name: str, *args, **kwargs) -> QuerySet:
        return self.values(field_name).annotate_sum(*args, **kwargs)
