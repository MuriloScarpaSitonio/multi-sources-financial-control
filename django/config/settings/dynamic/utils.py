from decimal import Decimal
from importlib import import_module
from typing import Any

from django.conf import settings

import requests


def import_module_attr(path: str) -> Any:
    package, module = path.rsplit(".", 1)
    return getattr(import_module(package), module)


def fetch_dollar_conversion_ratio() -> Decimal:
    result = requests.get(
        settings.ASSETS_INTEGRATIONS_URL + "convert_currency?from_=USD&to=BRL"
    ).json()
    return Decimal(str(result))
