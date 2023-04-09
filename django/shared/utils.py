from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from functools import reduce
from typing import Any, Dict, List, Optional, Tuple, TypedDict
from urllib.parse import urlencode, urljoin

from dateutil import relativedelta

from django.db.models import Sum
from django.db.models.functions import Coalesce


class MonthlyHistoricType(TypedDict, total=False):
    month: datetime
    total: float


def build_url(
    url: str, parts: Tuple[str, ...], query_params: Optional[Dict[str, Any]] = None
) -> str:
    query_params = query_params if query_params is not None else dict()
    query_params = {k: v for k, v in query_params.items() if v is not None}
    return reduce(urljoin, (url,) + parts) + f"?{urlencode(query_params)}"


def coalesce_sum_expression(*args, extra: Optional[Any] = None, **kwargs) -> Coalesce:
    result = Coalesce(Sum(*args, **kwargs), Decimal())
    return result * extra if extra is not None else result


def insert_zeros_if_no_data_in_monthly_historic_data(
    historic: List[MonthlyHistoricType], total_fields: Tuple[str, ...] = ("total",)
) -> List[MonthlyHistoricType]:
    if len(historic) == 13:
        return historic

    _historic, diffs = deepcopy(historic), 0
    for idx, (current, _next) in enumerate(zip(historic[:], historic[1:])):
        delta = relativedelta.relativedelta(dt1=_next["month"], dt2=current["month"])
        diff_months = delta.months + (12 * delta.years)
        for diff in range(1, diff_months):
            _historic.insert(
                idx + diff + diffs,
                {
                    "month": current["month"] + relativedelta.relativedelta(months=diff),
                    **{k: 0 for k in total_fields},
                },
            )
        diffs += diff_months - 1
    return _historic
