from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.functional import cached_property

from shared.models_utils import serializable_today_function
from tasks.models import TaskHistory

from .choices import AssetTypes, PassiveIncomeTypes, TransactionActions
from .managers import PassiveIncomeQuerySet, TransactionQuerySet


class Asset(models.Model):
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, choices=AssetTypes.choices)
    current_price = models.DecimalField(
        decimal_places=2, max_digits=9, blank=True, null=True
    )
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assets",
    )

    class Meta:
        ordering = ("-code",)
        unique_together = ("user", "code")

    def __str__(self) -> str:
        return self.code  # pragma: no cover

    __repr__ = __str__

    @cached_property
    def avg_price(self) -> Decimal:
        return self.transactions.avg_price()["avg_price"]

    @cached_property
    def adjusted_avg_price(self) -> Decimal:
        infos = self.transactions.avg_price(include_quantity=True)
        return (
            (infos["avg_price"] * infos["quantity_sum"])
            - self.incomes.credited().sum()["total"]
        ) / infos["quantity_sum"]

    @cached_property
    def quantity(self) -> Decimal:
        return self.transactions.get_current_quantity()["quantity"]

    @property
    def total_invested(self) -> Decimal:
        return self.avg_price * self.quantity

    @property
    def total_adjusted_invested(self) -> Decimal:
        return self.adjusted_avg_price * self.quantity

    def get_ROI(self, percentage: bool = False) -> Decimal:
        """ROI: Return On Investment"""
        return self.transactions.roi(percentage=percentage)["ROI"]


class Transaction(models.Model):
    action = models.CharField(max_length=4, choices=TransactionActions.choices)
    price = models.DecimalField(decimal_places=2, max_digits=9)
    quantity = models.DecimalField(
        decimal_places=8, max_digits=15
    )  # cripto needs a lot of decimal places
    created_at = models.DateField(default=serializable_today_function)
    asset = models.ForeignKey(
        to=Asset,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    # esse campo é válido apenas para transações de VENDA e é usado
    # para calcular o ROI do investimento
    initial_price = models.DecimalField(
        decimal_places=2, max_digits=6, blank=True, null=True
    )
    fetched_by = models.ForeignKey(
        to=TaskHistory,
        null=True,
        blank=True,
        related_name="transactions",
        on_delete=models.SET_NULL,
    )

    objects = TransactionQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"<Transaction {self.action} {self.quantity} {self.asset.code} {self.price}>"  # pragma: no cover

    __repr__ = __str__


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
    fetched_by = models.ForeignKey(
        to=TaskHistory,
        null=True,
        blank=True,
        related_name="incomes",
        on_delete=models.SET_NULL,
    )

    objects = PassiveIncomeQuerySet.as_manager()

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
