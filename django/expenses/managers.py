from decimal import Decimal
from typing import Dict, Union

from django.db.models import QuerySet, Sum
from django.db.models.functions import TruncMonth

from shared.managers_utils import CustomQueryset


class ExpenseQueryset(CustomQueryset):
    @staticmethod
    def _get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("price")}

    def filter_by_month_and_year(self, month: int, year: int) -> QuerySet:
        return self.filter(created_at__month=month, created_at__year=year)

    def report(self) -> Dict[str, Union[QuerySet, Decimal]]:
        return {
            "categories": self.aggregate_field("category"),
            "sources": self.aggregate_field("source"),
            "type": self.aggregate_field("is_fixed"),
            **self.sum(),
        }

    def historic(self) -> QuerySet:
        return (
            self.annotate(month=TruncMonth("created_at")).values("month").annotate_sum()
        )
