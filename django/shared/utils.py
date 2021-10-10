from functools import reduce
from typing import Any, Dict, Tuple
from urllib.parse import urlencode, urljoin


def build_url(url: str, parts: Tuple[str, ...], query_params: Dict[str, Any] = dict()):
    query_params = {k: v for k, v in query_params.items() if v is not None}
    return reduce(urljoin, (url,) + parts) + f"?{urlencode(query_params)}"
