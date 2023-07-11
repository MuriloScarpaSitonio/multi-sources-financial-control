from decimal import Decimal, ROUND_HALF_UP
from functools import singledispatch

from django.db.models import Q

from config.settings.dynamic import dynamic_settings

from ..choices import Currencies
from ..models import Asset, AssetMetaData


def _get_total_sold_brute_force(asset: Asset, normalize: bool = False):
    total = 0
    for transaction in asset.transactions.sold():
        t = (transaction.price - transaction.initial_price) * transaction.quantity
        if normalize:
            t *= transaction.current_currency_conversion_rate
        total += t
    return total


def get_current_price_metadata(asset: Asset, normalize: bool = False) -> Decimal:
    metadata = AssetMetaData.objects.only("current_price", "currency").get(
        code=asset.code, type=asset.type, currency=asset.currency
    )
    if metadata.currency != Currencies.real and normalize:
        return metadata.current_price * dynamic_settings.DOLLAR_CONVERSION_RATE
    return metadata.current_price


def get_total_bought_brute_force(asset: Asset, normalize: bool = True):
    result = sum(
        (transaction.price * transaction.quantity for transaction in asset.transactions.bought())
    )
    if normalize and asset.currency != Currencies.real:
        result *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return result


def get_avg_price_bute_force(asset: Asset, normalize: bool = False, extra_filters: Q = Q()):
    weights = []
    quantities = []
    for transaction in asset.transactions.filter(extra_filters).bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    weights = sum(weights)
    if normalize and asset.currency != Currencies.real:
        weights *= dynamic_settings.DOLLAR_CONVERSION_RATE

    return weights / sum(quantities)


def get_quantity_balance_brute_force(asset: Asset, extra_filters: Q = Q()):
    bought = (
        transaction.quantity for transaction in asset.transactions.filter(extra_filters).bought()
    )
    sold = (transaction.quantity for transaction in asset.transactions.filter(extra_filters).sold())

    return sum(bought) - sum(sold)


def get_total_credited_incomes_brute_force(
    asset: Asset, normalize: bool = True, extra_filters: Q = Q()
):
    total = 0
    for income in asset.incomes.credited().filter(extra_filters):
        t = income.amount
        if normalize:
            t *= income.current_currency_conversion_rate
        total += t
    return total


def get_adjusted_avg_price_brute_forte(asset: Asset, normalize: bool = True):
    weights = []
    quantities = []
    for transaction in asset.transactions.bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    quantity_balance = get_quantity_balance_brute_force(asset=asset)

    weights = sum(weights)
    if normalize and asset.currency != Currencies.real:
        weights *= dynamic_settings.DOLLAR_CONVERSION_RATE

    avg_price = weights / sum(quantities)
    return (
        (avg_price * quantity_balance)
        - get_total_credited_incomes_brute_force(asset, normalize=normalize)
    ) / quantity_balance


def get_roi_brute_force(asset: Asset, normalize: bool = True):
    total_sold = _get_total_sold_brute_force(asset=asset, normalize=normalize)
    total_incomes = get_total_credited_incomes_brute_force(asset=asset, normalize=normalize)
    quantity_balance = get_quantity_balance_brute_force(asset=asset)
    avg_price = get_avg_price_bute_force(asset=asset, normalize=normalize)
    current_price = get_current_price_metadata(asset)

    if normalize and asset.currency != Currencies.real:
        current_price *= dynamic_settings.DOLLAR_CONVERSION_RATE
        # avg_price *= dynamic_settings.DOLLAR_CONVERSION_RATE

    current_total = current_price * quantity_balance
    total_invested = avg_price * quantity_balance
    return current_total - (total_invested - total_incomes - total_sold)


def convert_to_percentage_and_quantitize(
    value: Decimal, total: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> Decimal:
    value = (value / total) * Decimal("100.0")
    return value.quantize(Decimal(".1") ** decimal_places, rounding=rounding)


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


get_total_invested_brute_force = (
    lambda asset, normalize=True, extra_filters=Q(): get_avg_price_bute_force(
        asset, normalize=normalize, extra_filters=extra_filters
    )
    * get_quantity_balance_brute_force(asset, extra_filters=extra_filters)
)

get_current_total_invested_brute_force = lambda asset, normalize=True: get_current_price_metadata(
    asset, normalize=normalize
) * get_quantity_balance_brute_force(asset)
