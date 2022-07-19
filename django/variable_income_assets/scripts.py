from decimal import Decimal

from django.utils import timezone
from django.db.models import F, OuterRef, Q, Subquery, Sum

from shared.utils import coalesce_sum_expression

from .choices import PassiveIncomeTypes, TransactionActions
from .managers import TransactionQuerySet
from .models import Asset, PassiveIncome, Transaction


def generate_irpf(year: int = timezone.now().year - 1):  # pragma: no cover
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

    # qs = (
    #     Asset.objects.annotate(transactions_balance=Subquery(transactions_qs.values("balance")))
    #     .annotate_roi()
    #     .filter(transactions_balance__lte=0, roi__gt=0)
    # )
    qs = Asset.objects.annotate_roi().filter(roi__gt=0)

    print("\n\n------------ OPERAÇÕES FINALIZADAS B3 ------------\n\n")
    _sum = []
    for month in range(1, 13):
        _qs = (
            qs.stocks()
            .annotate(
                transactions_balance=Subquery(
                    transactions_qs.filter(created_at__month=month, created_at__year=year).values(
                        "balance"
                    )
                )
            )
            .filter(transactions_balance__lte=0)
            .aggregate(total=Sum("roi"))
        )
        total = _qs["total"]
        print(f"{month:02}/{str(year)[2:]}: {total}")

        _sum.append(total if total else Decimal())
    print(f"\nTOTAL: {sum(_sum)}")

    print("\n\n------------ OPERAÇÕES FINALIZADAS USA ------------\n\n")
    _sum = []
    for month in range(1, 13):
        _qs = (
            qs.stocks_usa()
            .annotate(
                transactions_balance=Subquery(
                    transactions_qs.filter(created_at__month=month, created_at__year=year).values(
                        "balance"
                    )
                )
            )
            .filter(transactions_balance__lte=0)
            .aggregate(total=Sum("roi"))
        )
        total = _qs["total"]
        print(f"{month:02}/{str(year)[2:]}: {total}")

        _sum.append(total if total else Decimal())
    print(f"\nTOTAL: {sum(_sum)}")

    print("\n\n------------ OPERAÇÕES FINALIZADAS CRIPTOS ------------\n\n")
    _sum = []
    for month in range(1, 13):
        _qs = (
            qs.cryptos()
            .annotate(
                transactions_balance=Subquery(
                    transactions_qs.filter(created_at__month=month, created_at__year=year).values(
                        "balance"
                    )
                )
            )
            .filter(transactions_balance__lte=0)
            .aggregate(total=Sum("roi"))
        )
        total = _qs["total"]
        print(f"{month:02}/{str(year)[2:]}: {total}")

        _sum.append(total if total else Decimal())
    print(f"\nTOTAL: {sum(_sum)}")
