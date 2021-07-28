from decimal import Decimal

from django.db import models
from django.utils import timezone

from .choices import AssetTypes, PassiveIncomeTypes, TransactionOptions


class Asset(models.Model):
    code = models.CharField(max_length=10, null=False, blank=False)
    type = models.CharField(
        max_length=10, choices=AssetTypes.choices, null=False, blank=False
    )

    __avg_price_expression__ = models.ExpressionWrapper(
        (
            # models.functions.Cast won't work
            models.Sum(models.F("price") * models.F("quantity"))
            * Decimal("1.0")  # cast result to a decimal value
        )
        / models.Sum("quantity"),
        output_field=models.DecimalField(),
    )

    @property
    def avg_price(self):
        return self.transactions.filter(action=TransactionOptions.buy).aggregate(
            avg_price=self.__avg_price_expression__
        )["avg_price"]

    @property
    def adjusted_avg_price(self):
        transactions_infos = self.transactions.filter(
            action=TransactionOptions.buy
        ).aggregate(models.Sum("quantity"), avg_price=self.__avg_price_expression__)
        incomes_sum = self.incomes.aggregate(models.Sum("amount"))["amount__sum"]

        return (
            (transactions_infos["avg_price"] * transactions_infos["quantity__sum"])
            - incomes_sum
        ) / transactions_infos["quantity__sum"]


def today():
    return timezone.now().date()


class Transaction(models.Model):
    action = models.CharField(
        max_length=4, choices=TransactionOptions.choices, null=False, blank=False
    )
    price = models.DecimalField(decimal_places=2, max_digits=6, null=False, blank=False)
    quantity = models.PositiveSmallIntegerField(null=False, blank=False)
    created_at = models.DateField(null=False, blank=False, default=today)
    asset = models.ForeignKey(
        to=Asset,
        on_delete=models.CASCADE,
        null=False,
        blank=False,
        related_name="transactions",
    )


class PassiveIncome(models.Model):
    type = models.CharField(
        max_length=8, choices=PassiveIncomeTypes.choices, null=False, blank=False
    )
    amount = models.DecimalField(
        decimal_places=2, max_digits=6, null=False, blank=False
    )
    received_at = models.DateField(null=False, blank=False, default=today)
    asset = models.ForeignKey(
        to=Asset,
        on_delete=models.CASCADE,
        null=False,
        blank=False,
        related_name="incomes",
    )
