from decimal import Decimal  # pragma: no cover
from typing import Optional, Union  # pragma: no cover

from django.utils import timezone
from django.db.models import F, OuterRef, Q, Subquery
from django.db.transaction import atomic

from config.settings.base import DOLLAR_CONVERSION_RATE
from shared.utils import coalesce_sum_expression

from .choices import (
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)  # pragma: no cover
from .managers import TransactionQuerySet
from .models import Asset, PassiveIncome, Transaction  # pragma: no cover


class DryRunException(Exception):  # pragma: no cover
    pass


def dry_run_decorator(function):  # pragma: no cover
    def wrap(*args, **kwargs):
        with atomic():
            function(*args, **kwargs)
            raise DryRunException()

    return wrap


def _get_avg_price(asset: Asset, currency: TransactionCurrencies) -> Decimal:  # pragma: no cover
    avg_price = asset.adjusted_avg_price_from_transactions
    if currency == TransactionCurrencies.dollar:
        avg_price /= DOLLAR_CONVERSION_RATE
    return avg_price


@dry_run_decorator  # pragma: no cover
def calculate_new_avg_price(
    asset: Union[str, Asset],
    price: Decimal,
    total: Optional[Decimal] = None,
    quantity: Optional[Decimal] = None,
    currency: Optional[TransactionCurrencies] = None,
) -> Decimal:
    print(f"\n--------------------Calculating {asset}--------------------\n")
    kwargs = {"price": price}
    if currency is not None:
        kwargs["currency"] = currency
    if quantity is not None:
        kwargs["quantity"] = quantity
    else:
        kwargs["quantity"] = total / price

    if isinstance(asset, str):
        asset = Asset.objects.get(code=asset)

    total = price * quantity if total is None else total
    total = total * DOLLAR_CONVERSION_RATE if currency == TransactionCurrencies.dollar else total
    print(f"Investing: {total}")
    print(f"BEFORE: {_get_avg_price(asset=asset, currency=currency)}")
    Transaction.objects.create(asset=asset, action=TransactionActions.buy, **kwargs)
    asset.refresh_from_db()

    # clear cached property
    del asset.__dict__["adjusted_avg_price_from_transactions"]
    # del asset.__dict__["quantity_from_transactions"]
    print(f"AFTER: {_get_avg_price(asset=asset, currency=currency)}")

    print(f"\n\nTotal adjusted invested: {asset.total_adjusted_invested_from_transactions}")
    print("\n\n")
    return total


def generate_irpf(year: int = timezone.now().year - 1):
    transactions_qs = (
        Transaction.objects.filter(asset=OuterRef("pk"), created_at__year__lte=year)
        .values("asset__pk")  # group by as we can't aggregate directly
        .annotate(balance=TransactionQuerySet.expressions.quantity_balance)
    )
    assets = (
        Asset.objects.annotate(transactions_balance=Subquery(transactions_qs.values("balance")))
        .filter(transactions_balance__gt=0)
        .annotate(
            avg_price=(
                coalesce_sum_expression(
                    F("transactions__price") * F("transactions__quantity"),
                    filter=Q(
                        transactions__action=TransactionActions.buy,
                        transactions__created_at__year__lte=year,
                    ),
                )
            )
            / coalesce_sum_expression(
                "transactions__quantity",
                filter=Q(
                    transactions__action=TransactionActions.buy,
                    transactions__created_at__year__lte=year,
                ),
            ),
            total_invested=F("avg_price") * F("transactions_balance"),
        )
    ).values("code", "transactions_balance", "avg_price", "total_invested")

    print("------------ ATIVOS ------------\n\n")
    for asset in assets:
        print(asset["code"])
        print(f"\tQuantidade: {asset['transactions_balance']}")
        print(f"\tPreço médio: {asset['avg_price']}")
        print(f"\tTotal: {asset['total_invested']}\n")

    incomes_qs = (
        PassiveIncome.objects.filter(asset=OuterRef("pk"), operation_date__year=year)
        .credited()
        .values("asset__pk")
        .annotate(total=coalesce_sum_expression("amount"))
    )
    qs = Asset.objects.order_by().distinct()
    print("\n\n------------ DIVIDENDOS ------------\n\n")
    for a in qs.annotate(
        credited_incomes_total=Subquery(
            incomes_qs.filter(type=PassiveIncomeTypes.dividend).values("total")
        )
    ).filter(credited_incomes_total__gt=0):
        print(a.code, a.credited_incomes_total)

    print("\n\n------------ JCP ------------\n\n")
    for a in qs.annotate(
        credited_incomes_total=Subquery(
            incomes_qs.filter(type=PassiveIncomeTypes.jcp).values("total")
        )
    ).filter(credited_incomes_total__gt=0):
        print(a.code, a.credited_incomes_total)

    print("\n\n------------ INCOMES ------------\n\n")
    for a in qs.annotate(
        credited_incomes_total=Subquery(
            incomes_qs.filter(type=PassiveIncomeTypes.income).values("total")
        )
    ).filter(credited_incomes_total__gt=0):
        print(a.code, a.credited_incomes_total)
