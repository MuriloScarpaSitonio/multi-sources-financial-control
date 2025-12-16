from decimal import ROUND_HALF_UP, Decimal
from functools import singledispatch
from typing import TYPE_CHECKING

from django.conf import settings

import pytest

if TYPE_CHECKING:
    from django.db.models import QuerySet


skip_if_sqlite = pytest.mark.skipif(
    "sqlite" in settings.DATABASES["default"]["ENGINE"],
    reason="SQLite uses integer division; test requires PostgreSQL for accurate results",
)


@singledispatch
def convert_and_quantitize(
    value: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> float:
    return float(value.quantize(Decimal(".1") ** decimal_places, rounding=rounding))


@convert_and_quantitize.register
def _(value: float, decimal_places: int = 2, rounding: str = ROUND_HALF_UP) -> float:
    return float(Decimal(str(value)).quantize(Decimal(".1") ** decimal_places, rounding=rounding))


@convert_and_quantitize.register
def _(value: int, decimal_places: int = 2, rounding: str = ROUND_HALF_UP) -> float:
    return float(Decimal(str(value)).quantize(Decimal(".1") ** decimal_places, rounding=rounding))


def convert_to_percentage_and_quantitize(
    value: Decimal, total: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> Decimal:
    value = (value / total) * Decimal("100.0")
    return value.quantize(Decimal(".1") ** decimal_places, rounding=rounding)


def calculate_since_year_ago_avg(queryset: "QuerySet") -> Decimal:
    """
    Calculate the expected average independently from the API logic.

    Args:
        queryset: A QuerySet of Expense or Revenue objects filtered by user_id

    Returns:
        The average as a Decimal
    """
    from django.utils import timezone

    today = timezone.localdate()
    # Replicate since_a_year_ago filter:
    # (month >= today.month AND year == today.year - 1) OR (month <= today.month AND year == today.year)
    # Exclude current month
    total_sum = Decimal("0.0")
    distinct_months = set()

    for item in queryset:
        if (
            (item.created_at.month >= today.month and item.created_at.year == today.year - 1)
            or (item.created_at.month <= today.month and item.created_at.year == today.year)
        ) and not (item.created_at.month == today.month and item.created_at.year == today.year):
            total_sum += item.value
            distinct_months.add((item.created_at.month, item.created_at.year))

    month_count = max(len(distinct_months), 1)
    return total_sum / Decimal(month_count)
