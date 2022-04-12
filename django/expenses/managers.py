from decimal import Decimal
from typing import Dict, Union

from django.db.models import Avg, QuerySet, Sum
from django.db.models.functions import TruncMonth

from shared.managers_utils import CustomQueryset, MonthlyFilterMixin

from .choices import ExpenseReportType


class ExpenseQueryset(CustomQueryset, MonthlyFilterMixin):
    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("price")}

    def report(self, of: str) -> Dict[str, Union["ExpenseQueryset", Decimal]]:
        """
        Args:
            of (str): The type of report. For valid choices check ExpenseReportType.choices
        """
        choice = ExpenseReportType.get_choice(value=of)
        return self.aggregate_field(field_name=choice.field_name)

    def trunc_months(self) -> QuerySet:
        return self.annotate(month=TruncMonth("created_at")).values("month").annotate_sum()

    def avg(self) -> Dict[str, Decimal]:
        return self.aggregate(avg=Avg("total"))
