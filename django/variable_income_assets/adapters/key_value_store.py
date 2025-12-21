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

    try:
        rate = ConversionRate.objects.get(
            from_currency=Currencies.dollar, to_currency=Currencies.real
        )
        value = rate.value
        key_value_backend.set(key=settings.DOLLAR_CONVERSION_RATE_KEY, value=value)
        return value
    except ConversionRate.DoesNotExist:
        return settings.DEFAULT_DOLLAR_CONVERSION_RATE
    except (OperationalError, ProgrammingError):
        # Table doesn't exist yet (e.g., during migrations)
        return settings.DEFAULT_DOLLAR_CONVERSION_RATE


def update_dollar_conversion_rate(value: Decimal | None = None) -> Decimal:
    from ..integrations.helpers import fetch_dollar_to_real_conversion_value
    from ..models.write import ConversionRate

    if value is None:
        try:
            value = fetch_dollar_to_real_conversion_value()
        except Exception:
            # TODO: log error
            value = settings.DEFAULT_DOLLAR_CONVERSION_RATE

    ConversionRate.objects.update_or_create(
        from_currency=Currencies.dollar,
        to_currency=Currencies.real,
        defaults={"value": value},
    )
    key_value_backend.set(key=settings.DOLLAR_CONVERSION_RATE_KEY, value=value)

    return value
