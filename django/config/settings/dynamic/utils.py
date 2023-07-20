from decimal import Decimal
from importlib import import_module
from typing import Any
from asgiref.sync import async_to_sync

from variable_income_assets.choices import Currencies
from variable_income_assets.integrations.clients import BrApiClient


def import_module_attr(path: str) -> Any:
    package, module = path.rsplit(".", 1)
    return getattr(import_module(package), module)


async def _fetch_dollar_to_real_conversion_value() -> str:
    async with BrApiClient() as client:
        return await client.convert_currencies(from_=Currencies.dollar, to=Currencies.real)


def fetch_dollar_to_real_conversion_value() -> Decimal:
    return Decimal(async_to_sync(_fetch_dollar_to_real_conversion_value)())
