from decimal import Decimal

from django.conf import settings

from config.key_value_store import key_value_backend


def get_dollar_conversion_rate() -> Decimal:
    value = key_value_backend.get(key=settings.DOLLAR_CONVERSION_RATE_KEY)
    return value if value is not None else settings.DEFAULT_DOLLAR_CONVERSION_RATE


def update_dollar_conversion_rate(value: Decimal | None = None) -> Decimal:
    from ..integrations.helpers import fetch_dollar_to_real_conversion_value

    if value is None:
        try:
            value = fetch_dollar_to_real_conversion_value()
        except Exception:
            # TODO: log error
            value = settings.DEFAULT_DOLLAR_CONVERSION_RATE

    key_value_backend.set(key=settings.DOLLAR_CONVERSION_RATE_KEY, value=value)

    return value
