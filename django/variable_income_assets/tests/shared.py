from decimal import Decimal

from django.db.models import Q

from ..adapters.key_value_store import get_dollar_conversion_rate
from ..choices import Currencies
from ..models import Asset, AssetMetaData


def get_total_sold_brute_force(
    asset: Asset,
    normalize: bool = True,
    extra_filters: Q | None = None,
):
    extra_filters = extra_filters if extra_filters is not None else Q()
    total = 0
    for transaction in asset.transactions.filter(extra_filters).sold():
        t = transaction.price * transaction.quantity
        if normalize:
            t *= transaction.current_currency_conversion_rate
        total += t
    return total


def get_closed_operations_totals(asset: Asset, normalize: bool = True) -> tuple[float, float]:
    total_sold = total_bought = 0
    for operation in asset.closed_operations.all():
        total_sold += operation.normalized_total_sold
        total_bought += operation.normalized_total_bought if normalize else operation.total_bought
    return total_sold, total_bought


def get_current_avg_price_bute_force(
    asset: Asset,
    normalize: bool = False,
    extra_filters: Q | None = None,
    closed_total_bought: float | None = None,
):
    extra_filters = extra_filters if extra_filters is not None else Q()
    field = "normalized_total_bought" if normalize else "total_bought"
    closed_total_bought = closed_quantity_bought = 0
    for op in asset.closed_operations.all():
        closed_total_bought += getattr(op, field)
        closed_quantity_bought += op.quantity_bought
    weights = []
    quantities = []
    for transaction in asset.transactions.filter(extra_filters).bought():
        w = transaction.price * transaction.quantity
        if normalize:
            w *= transaction.current_currency_conversion_rate
        weights.append(w)
        quantities.append(transaction.quantity)

    return (sum(weights) - closed_total_bought) / (sum(quantities) - closed_quantity_bought)


def get_current_adjusted_avg_price_brute_forte(
    asset: Asset,
    normalize: bool = True,
    closed_total_bought: float | None = None,
):
    quantity_balance = get_quantity_balance_brute_force(asset=asset)
    if not quantity_balance:
        return Decimal()
    field = "normalized_total_bought" if normalize else "total_bought"
    closed_total_bought = (
        closed_total_bought
        if closed_total_bought is not None
        else sum(asset.closed_operations.values_list(field, flat=True))
    )
    avg_price = get_current_avg_price_bute_force(asset=asset, normalize=normalize)
    incomes = get_total_credited_incomes_brute_force(
        asset, normalize=normalize
    ) - _get_finsished_credited_incomes_brute_force(asset, normalize=normalize)
    return ((avg_price * quantity_balance) - incomes) / quantity_balance


def _get_finsished_credited_incomes_brute_force(asset: Asset, normalize: bool = True):
    total = 0
    for operation in asset.closed_operations.all():
        total += operation.normalized_credited_incomes if normalize else operation.credited_incomes
    return total


def get_current_price_metadata(asset: Asset, normalize: bool = False) -> Decimal:
    metadata = AssetMetaData.objects.only("current_price", "currency").get(
        code=asset.code, type=asset.type, currency=asset.currency
    )
    if metadata.currency != Currencies.real and normalize:
        return metadata.current_price * get_dollar_conversion_rate()
    return metadata.current_price


def get_current_total_bought_brute_force(asset: Asset, normalize: bool = True):
    _, closed_total_bought = get_closed_operations_totals(asset=asset, normalize=normalize)
    return get_total_bought_brute_force(asset=asset, normalize=normalize) - closed_total_bought


def get_total_bought_brute_force(
    asset: Asset, normalize: bool = True, extra_filters: Q | None = None
):
    extra_filters = extra_filters if extra_filters is not None else Q()
    total = 0
    for transaction in asset.transactions.filter(extra_filters).bought():
        t = transaction.price * transaction.quantity
        if normalize:
            t *= transaction.current_currency_conversion_rate
        total += t
    return total


def get_avg_price_bute_force(asset: Asset, normalize: bool = False, extra_filters: Q | None = None):
    extra_filters = extra_filters if extra_filters is not None else Q()
    weights = []
    quantities = []
    for transaction in asset.transactions.filter(extra_filters).bought():
        w = transaction.price * transaction.quantity
        if normalize:
            w *= transaction.current_currency_conversion_rate
        weights.append(w)
        quantities.append(transaction.quantity)

    return sum(weights) / sum(quantities)


def get_quantity_bought_brute_force(asset: Asset, extra_filters: Q | None = None):
    transactions = asset.transactions.filter(extra_filters if extra_filters is not None else Q())
    return sum(transactions.bought().values_list("quantity", flat=True))


def get_quantity_balance_brute_force(asset: Asset, extra_filters: Q | None = None):
    transactions = asset.transactions.filter(extra_filters if extra_filters is not None else Q())

    return get_quantity_bought_brute_force(asset, extra_filters) - sum(
        transactions.sold().values_list("quantity", flat=True)
    )


def get_total_credited_incomes_brute_force(
    asset: Asset, normalize: bool = True, extra_filters: Q | None = None
):
    extra_filters = extra_filters if extra_filters is not None else Q()
    total = 0
    for income in asset.incomes.credited().filter(extra_filters):
        t = income.amount
        if normalize:
            t *= income.current_currency_conversion_rate
        total += t
    return total


def get_roi_brute_force(asset: Asset, normalize: bool = True):
    total_sold = get_total_sold_brute_force(asset=asset, normalize=normalize)
    total_bought = get_total_bought_brute_force(asset, normalize=normalize)
    total_incomes = get_total_credited_incomes_brute_force(asset=asset, normalize=normalize)
    quantity_balance = get_quantity_balance_brute_force(asset=asset)
    current_price = get_current_price_metadata(asset)

    if normalize and asset.currency == Currencies.dollar:
        current_price *= get_dollar_conversion_rate()

    current_total = current_price * quantity_balance
    return current_total - (total_bought - total_incomes - total_sold)


def get_current_roi_brute_force(asset: Asset, normalize: bool = True):
    total_sold = get_total_sold_brute_force(asset=asset, normalize=normalize)
    total_bought = get_total_bought_brute_force(asset, normalize=normalize)
    closed_total_sold, closed_total_bought = get_closed_operations_totals(
        asset=asset, normalize=normalize
    )
    total_incomes = get_total_credited_incomes_brute_force(asset=asset, normalize=normalize)
    closed_incomes = _get_finsished_credited_incomes_brute_force(asset=asset)
    quantity_balance = get_quantity_balance_brute_force(asset=asset)
    current_price = get_current_price_metadata(asset)

    if normalize and asset.currency == Currencies.dollar:
        current_price *= get_dollar_conversion_rate()

    current_total = current_price * quantity_balance
    total_invested = total_bought - closed_total_bought
    current_incomes = total_incomes - closed_incomes
    current_sold = total_sold - closed_total_sold
    return current_total - (total_invested - current_incomes - current_sold)


def get_total_invested_brute_force(asset, normalize=True, extra_filters: Q | None = None):
    extra_filters = extra_filters if extra_filters is not None else Q()
    return get_avg_price_bute_force(
        asset, normalize=normalize, extra_filters=extra_filters
    ) * get_quantity_balance_brute_force(asset, extra_filters=extra_filters)


def get_current_total_invested_brute_force(asset, normalize=True):
    return get_current_price_metadata(
        asset, normalize=normalize
    ) * get_quantity_balance_brute_force(asset)
