from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from utils.models_utils import serializable_today_function

from .choices import AssetTypes, PassiveIncomeTypes, TransactionOptions


class Asset(models.Model):
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, choices=AssetTypes.choices)
    user = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    __avg_price_expression__ = models.ExpressionWrapper(
        (
            # models.functions.Cast won't work
            models.Sum(models.F("price") * models.F("quantity"))
            * Decimal("1.0")  # cast result to a decimal value
        )
        / models.Sum("quantity"),
        output_field=models.DecimalField(),
    )

    def __str__(self) -> str:
        return f"<Asset ({self.code})>"

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
        incomes_sum = self.incomes.filter(credited_at__is_null=False).aggregate(
            models.Sum("amount")
        )["amount__sum"]

        return (
            (transactions_infos["avg_price"] * transactions_infos["quantity__sum"])
            - incomes_sum
        ) / transactions_infos["quantity__sum"]


class Transaction(models.Model):
    action = models.CharField(max_length=4, choices=TransactionOptions.choices)
    price = models.DecimalField(decimal_places=2, max_digits=6)
    quantity = models.PositiveSmallIntegerField()
    created_at = models.DateField(default=serializable_today_function)
    asset = models.ForeignKey(
        to=Asset,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    current_avg_price = models.DecimalField(
        decimal_places=2, max_digits=6, blank=True, null=True
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"<Transaction {self.action} {self.quantity} {self.asset.code} {self.price}>"


class PassiveIncome(models.Model):
    type = models.CharField(max_length=8, choices=PassiveIncomeTypes.choices)
    amount = models.DecimalField(decimal_places=2, max_digits=6)
    credited_at = models.DateField(null=True, blank=True)
    payment_forecast = models.DateField(null=True, blank=True)
    asset = models.ForeignKey(
        to=Asset,
        on_delete=models.CASCADE,
        related_name="incomes",
    )

    class Meta:
        ordering = ("-credited_at", "-payment_forecast", "-amount")

    """def clean(self):
        if self.credited_at is None and self.payment_forecast is None:
            raise ValidationError(
                "Both credited_at and payment_forecast can not be None"
            )

        if (
            self.credited_at
            and self.payment_forecast
            and self.credited_at < self.payment_forecast
        ):
            raise ValidationError(
                "payment_forecast can not be greater than credited_at"
            )"""
