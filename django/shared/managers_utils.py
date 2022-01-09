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
        date_field_name = getattr(self, "DATE_FIELD_NAME", "created_at")
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
                    **{
                        f"{date_field_name}__month": today.month,
                        f"{date_field_name}__year": today.year,
                    }
                )
                | Q(
                    **{
                        f"{date_field_name}__month": last_month,
                        f"{date_field_name}__year": year,
                    }
                )
            )
            .annotate(month=TruncMonth(date_field_name))
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
        date_field_name = getattr(self, "DATE_FIELD_NAME", "created_at")
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
