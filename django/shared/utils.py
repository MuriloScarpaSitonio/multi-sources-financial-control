from __future__ import annotations

from copy import deepcopy
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
    historic: list[MonthlyHistoricType], total_fields: tuple[str, ...] = ("total",)
) -> list[MonthlyHistoricType]:
    if len(historic) == 13:
        return historic

    return _insert_zeros_in_between(historic=historic, total_fields=total_fields)


def _insert_zeros_in_between(
    historic: list[MonthlyHistoricType], total_fields: tuple[str, ...]
) -> list[MonthlyHistoricType]:
    _historic, diffs = deepcopy(historic), 0
    for idx, (current, _next) in enumerate(zip(historic[:], historic[1:])):  # noqa: B905
        delta = relativedelta(dt1=_next["month"], dt2=current["month"])
        diff_months = delta.months + (12 * delta.years)
        for diff in range(1, diff_months):
            _historic.insert(
                idx + diff + diffs,
                {
                    "month": current["month"] + relativedelta(months=diff),
                    **{k: 0 for k in total_fields},
                },
            )
        diffs += diff_months - 1
    return _historic


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
