from decimal import Decimal

from django.conf import settings
from django.db import OperationalError, ProgrammingError

from config.key_value_store import key_value_backend

from ..choices import Currencies


def get_dollar_conversion_rate() -> Decimal:
    value = key_value_backend.get(key=settings.DOLLAR_CONVERSION_RATE_KEY)
    if value is not None:
        return value

    # Cache miss - query DB
    from ..models.write import ConversionRate

    value = ConversionRate.objects.values_list("value", flat=True).get(
        from_currency=Currencies.dollar, to_currency=Currencies.real
    )
    key_value_backend.set(key=settings.DOLLAR_CONVERSION_RATE_KEY, value=value)
    return value


def update_dollar_conversion_rate(value: Decimal | None = None) -> Decimal:
    from ..integrations.helpers import fetch_dollar_to_real_conversion_value
    from ..models.write import ConversionRate

    if value is None:
        value = fetch_dollar_to_real_conversion_value()

    ConversionRate.objects.update_or_create(
        from_currency=Currencies.dollar,
        to_currency=Currencies.real,
        defaults={"value": value},
    )
    key_value_backend.set(key=settings.DOLLAR_CONVERSION_RATE_KEY, value=value)

    return value
