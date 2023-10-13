from decimal import Decimal

from config.key_value_store import key_value_backend

DOLLAR_CONVERSION_RATE_KEY = "DOLLAR_CONVERSION_RATE"


def get_dollar_conversion_rate() -> Decimal:
    value = key_value_backend.get(key=DOLLAR_CONVERSION_RATE_KEY)
    return value if value is not None else Decimal("5.0")


def update_dollar_conversion_rate(value: Decimal | None = None) -> None:
    from ..integrations.helpers import fetch_dollar_to_real_conversion_value

    if value is None:
        try:
            value = fetch_dollar_to_real_conversion_value()
        except Exception:
            # TODO: log error
            value = Decimal("5.0")

    key_value_backend.set(key=DOLLAR_CONVERSION_RATE_KEY, value=value)
