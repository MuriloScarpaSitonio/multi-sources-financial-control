from decimal import Decimal, ROUND_HALF_UP

from config.settings.dynamic import dynamic_settings

from ..choices import TransactionCurrencies
from ..models import Asset


def _get_total_sold_brute_force(asset: Asset):
    result = sum(
        (
            (transaction.price - transaction.initial_price) * transaction.quantity
            for transaction in asset.transactions.sold()
        )
    )
    if asset.currency_from_transactions != TransactionCurrencies.real:
        result *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return result


def get_total_bought_brute_force(asset: Asset):
    result = sum(
        (transaction.price * transaction.quantity for transaction in asset.transactions.bought())
    )
    if asset.currency_from_transactions != TransactionCurrencies.real:
        result *= dynamic_settings.DOLLAR_CONVERSION_RATE
    return result


def get_avg_price_bute_force(asset: Asset, normalize: bool = False):
    weights = []
    quantities = []
    for transaction in asset.transactions.bought():
        weights.append(transaction.price * transaction.quantity)
        quantities.append(transaction.quantity)

    weights = sum(weights)
    if asset.currency_from_transactions != TransactionCurrencies.real and normalize:
        weights *= dynamic_settings.DOLLAR_CONVERSION_RATE

    return weights / sum(quantities)


def get_adjusted_quantity_brute_force(asset: Asset):
    bought = (transaction.quantity for transaction in asset.transactions.bought())
    sold = (transaction.quantity for transaction in asset.transactions.sold())

    return sum(bought) - sum(sold)


def _get_total_credited_incomes(asset: Asset):
    return sum((income.amount for income in asset.incomes.credited()))


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
    incomes_sum = sum((income.amount for income in asset.incomes.credited()))
    return ((avg_price * adjusted_quantity) - incomes_sum) / adjusted_quantity


def get_roi_brute_force(asset: Asset, normalize: bool = True):
    total_sold = _get_total_sold_brute_force(asset=asset)
    total_incomes = _get_total_credited_incomes(asset=asset)
    adjusted_quantity = get_adjusted_quantity_brute_force(asset=asset)
    avg_price = get_avg_price_bute_force(asset=asset, normalize=normalize)

    return (get_current_price(asset) * adjusted_quantity) - (
        (avg_price * adjusted_quantity) - total_incomes - total_sold
    )


def convert_to_percentage_and_quantitize(
    value: Decimal, total: Decimal, decimal_places: int = 2, rounding: str = ROUND_HALF_UP
) -> Decimal:
    value = (value / total) * Decimal("100.0")
    return value.quantize(Decimal(".1") ** decimal_places, rounding=rounding)


def get_current_price(asset: Asset) -> Decimal:
    return (
        (asset.current_price or Decimal())
        if asset.currency_from_transactions == TransactionCurrencies.real
        else (asset.current_price or Decimal()) * dynamic_settings.DOLLAR_CONVERSION_RATE
    )


get_total_invested_brute_force = lambda asset, normalize=True: get_avg_price_bute_force(
    asset, normalize=normalize
) * get_adjusted_quantity_brute_force(asset)

get_current_total_invested_brute_force = lambda asset: get_current_price(
    asset
) * get_adjusted_quantity_brute_force(asset)
