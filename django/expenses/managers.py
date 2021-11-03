from decimal import Decimal
from typing import Dict, Union

from django.utils import timezone
from django.db.models import QuerySet, Sum
from django.db.models.functions import Lag, TruncMonth

from shared.managers_utils import CustomQueryset, IndicatorsMixin, MonthlyFilterMixin

from .choices import ExpenseReportType


class ExpenseQueryset(CustomQueryset, IndicatorsMixin, MonthlyFilterMixin):
    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("price")}

    def report(self, of: str) -> Dict[str, Union[QuerySet, Decimal]]:
        """
        Args:
            of (str): The type of report. For valid choices check ExpenseReportType.choices
        """
        choice = ExpenseReportType.get_choice(value=of)
        return self.aggregate_field(field_name=choice.field_name)

    def historic(self) -> QuerySet:
        today = timezone.now().date()
        return (
            self.filter(
                created_at__month__lte=today.month,
                created_at__year__lte=today.year,
            )
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate_sum()
            .order_by("month")
        )
