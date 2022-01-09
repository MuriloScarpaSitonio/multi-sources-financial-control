from decimal import Decimal
from functools import reduce
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode, urljoin

from django.db.models import Sum
from django.db.models.functions import Coalesce


def build_url(
    url: str, parts: Tuple[str, ...], query_params: Optional[Dict[str, Any]] = None
) -> str:
    query_params = query_params if query_params is not None else dict()
    query_params = {k: v for k, v in query_params.items() if v is not None}
    return reduce(urljoin, (url,) + parts) + f"?{urlencode(query_params)}"


def coalesce_sum_expression(*args, extra: Optional[Any] = None, **kwargs) -> Coalesce:
    result = Coalesce(Sum(*args, **kwargs), Decimal())
    return result * extra if extra is not None else result
