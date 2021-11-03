from typing import Dict

from django.db.models import Sum

from shared.managers_utils import CustomQueryset, IndicatorsMixin, MonthlyFilterMixin


class RevenueQueryset(CustomQueryset, IndicatorsMixin, MonthlyFilterMixin):
    @staticmethod
    def get_sum_expression() -> Dict[str, Sum]:
        return {"total": Sum("value")}
