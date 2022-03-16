from decimal import Decimal
from typing import Optional, Union

from django.db.transaction import atomic

from .choices import TransactionActions, TransactionCurrencies
from .models import Asset, Transaction


class DryRunException(Exception):
    def __init__(self):
        super().__init__("DryRunException")


def dry_run_decorator(function):
    def wrap(*args, **kwargs):
        with atomic():
            function(*args, **kwargs)
            raise DryRunException()

    return wrap


def _get_avg_price(asset: Asset, currency: TransactionCurrencies) -> Decimal:
    avg_price = asset.adjusted_avg_price_from_transactions
    if currency == TransactionCurrencies.dollar:
        avg_price /= Decimal("5.68")
    return avg_price


@dry_run_decorator
def calculate_new_avg_price(
    asset: Union[str, Asset],
    price: Decimal,
    total: Optional[Decimal] = None,
    quantity: Optional[Decimal] = None,
    currency: Optional[TransactionCurrencies] = None,
) -> None:
    kwargs = {"price": price}
    if currency is not None:
        kwargs["currency"] = currency
    if quantity is not None:
        kwargs["quantity"] = quantity
    else:
        kwargs["quantity"] = total / price

    if isinstance(asset, str):
        asset = Asset.objects.get(code=asset)

    print(f"BEFORE: {_get_avg_price(asset=asset, currency=currency)}")
    Transaction.objects.create(asset=asset, action=TransactionActions.buy, **kwargs)
    asset.refresh_from_db()

    # clear cached property
    del asset.__dict__["adjusted_avg_price_from_transactions"]
    print(f"AFTER: {_get_avg_price(asset=asset, currency=currency)}")
