from copy import deepcopy
from datetime import date
from typing import Required, TypedDict

from dateutil.relativedelta import relativedelta


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
