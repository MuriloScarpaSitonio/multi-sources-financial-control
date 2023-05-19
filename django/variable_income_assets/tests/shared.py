from decimal import Decimal, ROUND_HALF_UP
from functools import singledispatch

from django.db.models import Q

from config.settings.dynamic import dynamic_settings

from ..choices import TransactionCurrencies
from ..models import Asset


def _get_total_sold_brute_force(asset: Asset):
    return sum(
        (
            (transaction.price - transaction.initial_price) * transaction.quantity
            for transaction in asset.transactions.sold()
        )
    )


def get_total_bought_brute_force(asset: Asset):
    result = sum(
        (transaction.price * transaction.quantity for transaction in asset.transactions.bought())
    )
    if asset.currency_from_transactions != TransactionCurrencies.real:
        result *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return result


def get_avg_price_bute_force(asset: Asset, normalize: bool = False, extra_filters: Q = Q()):
    weights = []
    quantities = []
    for transaction in asset.transactions.filter(extra_filters).bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    weights = sum(weights)
    if asset.currency_from_transactions != TransactionCurrencies.real and normalize:
        weights *= dynamic_settings.DOLLAR_CONVERSION_RATE

    return weights / sum(quantities)


def get_adjusted_quantity_brute_force(asset: Asset, extra_filters: Q = Q()):
    bought = (
        transaction.quantity for transaction in asset.transactions.filter(extra_filters).bought()
    )
    sold = (transaction.quantity for transaction in asset.transactions.filter(extra_filters).sold())

    return sum(bought) - sum(sold)


def get_total_credited_incomes_brute_force(asset: Asset, extra_filters: Q = Q()):
    return sum((income.amount for income in asset.incomes.credited().filter(extra_filters)))


def get_adjusted_avg_price_brute_forte(asset: Asset):
    weights = []
    quantities = []
    for transaction in asset.transactions.bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    adjusted_quantity = get_adjusted_quantity_brute_force(asset=asset)

    weights = sum(weights)
    if asset.currency_from_transactions != TransactionCurrencies.real:
        weights *= dynamic_settings.DOLLAR_CONVERSION_RATE
    avg_price = weights / sum(quantities)

    return (
        (avg_price * adjusted_quantity) - get_total_credited_incomes_brute_force(asset)
    ) / adjusted_quantity


def get_roi_brute_force(asset: Asset, normalize: bool = True):
    total_sold = _get_total_sold_brute_force(asset=asset)
    total_incomes = get_total_credited_incomes_brute_force(asset=asset)
    adjusted_quantity = get_adjusted_quantity_brute_force(asset=asset)
    avg_price = get_avg_price_bute_force(asset=asset, normalize=False)

    result = (asset.current_price * adjusted_quantity) - (
        (avg_price * adjusted_quantity) - total_incomes - total_sold
    )
    if normalize and asset.currency_from_transactions != TransactionCurrencies.real:
        result *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return result


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


def get_current_price(asset: Asset, normalize: bool = False) -> Decimal:
    current_price = asset.current_price or Decimal()
    if asset.currency_from_transactions != TransactionCurrencies.real and normalize:
        current_price *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return current_price


get_total_invested_brute_force = (
    lambda asset, normalize=True, extra_filters=Q(): get_avg_price_bute_force(
        asset, normalize=normalize, extra_filters=extra_filters
    )
    * get_adjusted_quantity_brute_force(asset, extra_filters=extra_filters)
)

get_current_total_invested_brute_force = lambda asset, normalize=True: get_current_price(
    asset, normalize=normalize
) * get_adjusted_quantity_brute_force(asset)
