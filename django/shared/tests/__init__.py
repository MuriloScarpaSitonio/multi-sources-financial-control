from decimal import ROUND_HALF_UP, Decimal
from functools import singledispatch


@singledispatch
def convert_and_quantitize(
    value: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> float:
    return float(value.quantize(Decimal(".1") ** decimal_places, rounding=rounding))


@convert_and_quantitize.register
def _(value: float, decimal_places: int = 2, rounding: str = ROUND_HALF_UP) -> float:
    return float(Decimal(str(value)).quantize(Decimal(".1") ** decimal_places, rounding=rounding))


@convert_and_quantitize.register
def _(value: int, decimal_places: int = 2, rounding: str = ROUND_HALF_UP) -> float:
    return float(Decimal(str(value)).quantize(Decimal(".1") ** decimal_places, rounding=rounding))


def convert_to_percentage_and_quantitize(
    value: Decimal, total: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> Decimal:
    value = (value / total) * Decimal("100.0")
    return value.quantize(Decimal(".1") ** decimal_places, rounding=rounding)
