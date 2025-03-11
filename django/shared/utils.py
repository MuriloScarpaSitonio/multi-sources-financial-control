from __future__ import annotations

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING, Required, TypedDict

from django.db.transaction import atomic

from dateutil.relativedelta import relativedelta

if TYPE_CHECKING:
    from djchoices import DjangoChoices


class MonthlyHistoricType(TypedDict, total=False):
    month: Required[date]
    total: float


def insert_zeros_if_no_data_in_monthly_historic_data(
    historic: list[MonthlyHistoricType],
    start_date: date,
    end_date: date,
    month_field: str = "month",
    total_fields: tuple[str, ...] = ("total",),
) -> list[MonthlyHistoricType]:
    start_date = start_date.replace(day=1)
    end_date = end_date + relativedelta(day=31)
    historic_map = {h[month_field]: h for h in historic}

    result: list[MonthlyHistoricType] = []
    current_date = start_date

    while current_date <= end_date:
        if current_date in historic_map:
            result.append(historic_map[current_date])
        else:
            # Create a new entry with 0 values for total_fields
            zero_entry = {month_field: current_date, **{field: 0.0 for field in total_fields}}
            result.append(zero_entry)

        current_date += relativedelta(months=1)

    return result


def choices_to_enum(choices_class: type[DjangoChoices]) -> Enum:
    return Enum(choices_class.__name__ + "Enum", {choice[1]: choice[0] for choice in choices_class})


class DryRunException(Exception):
    ...  # pragma: no cover


def dry_run_decorator(function):  # pragma: no cover
    def wrap(*args, **kwargs):
        with atomic():
            result = function(*args, **kwargs)

            if kwargs.get("dry_run", True):
                raise DryRunException

            return result

    return wrap
