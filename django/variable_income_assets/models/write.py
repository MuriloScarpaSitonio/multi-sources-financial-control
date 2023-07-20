from decimal import Decimal
from typing import Literal

from django.conf import settings
from django.db import models
from django.utils.functional import cached_property

from shared.models_utils import serializable_today_function
from tasks.models import TaskHistory

from .managers import AssetQuerySet, PassiveIncomeQuerySet, TransactionQuerySet
from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    Currencies,
)
from ..domain.models import Asset as AssetDomainModel


class AssetMetaData(models.Model):
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, validators=[AssetTypes.validator])
    sector = models.CharField(
        max_length=50, validators=[AssetSectors.validator], default=AssetSectors.unknown
    )
    currency = models.CharField(max_length=6, validators=[Currencies.validator])
    current_price = models.DecimalField(decimal_places=6, max_digits=13)
    current_price_updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("code", "type", "currency"), name="code__type__currency__unique_together"
            ),
        ]

    def __str__(self) -> str:
        return f"<AssetMetaData ({self.code} | {self.type} | {self.currency})>"  # pragma: no cover

    __repr__ = __str__


class Asset(models.Model):
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, validators=[AssetTypes.validator])
    objective = models.CharField(
        max_length=50,
        validators=[AssetObjectives.validator],
        default=AssetObjectives.unknown,
    )
    currency = models.CharField(max_length=6, blank=True, validators=[Currencies.validator])
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assets",
    )

    objects = AssetQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("code", "type", "currency", "user"),
                name="code__type__currency__user__unique_together",
            ),
        ]

    def __str__(self) -> str:
        return f"<Asset ({self.code} | {self.type} | {self.user_id})>"  # pragma: no cover

    __repr__ = __str__

    @cached_property
    def avg_price_from_transactions(self) -> Decimal:
        return self.transactions.avg_price()["avg_price"]

    @cached_property
    def total_credited_incomes(self) -> Decimal:
        return self.incomes.credited().sum()["total"]

    @cached_property
    def adjusted_avg_price_from_transactions(self) -> Decimal:
        return self.transactions.avg_price(incomes=self.total_credited_incomes)["avg_price"]

    @cached_property
    def quantity_from_transactions(self) -> Decimal:
        return self.transactions.get_quantity_balance()["quantity"]

    @property
    def total_invested_from_transactions(self) -> Decimal:  # pragma: no cover
        return self.avg_price_from_transactions * self.quantity_from_transactions

    @property
    def total_adjusted_invested_from_transactions(self) -> Decimal:
        return self.adjusted_avg_price_from_transactions * self.quantity_from_transactions

    def get_roi(self, percentage: bool = False) -> Decimal:
        """ROI: Return On Investment"""
        return self.transactions.roi(incomes=self.total_credited_incomes, percentage=percentage)[
            "ROI"
        ]

    def to_domain(self) -> AssetDomainModel:
        # values may be already annotated. if so we don't have to do
        # extra queries to build the aggregations
        return AssetDomainModel(
            currency=self.currency,
            quantity_balance=getattr(self, "quantity_balance", self.quantity_from_transactions),
            avg_price=getattr(self, "avg_price", self.avg_price_from_transactions),
        )


class Transaction(models.Model):
    external_id = models.CharField(max_length=100, blank=True, null=True)
    action = models.CharField(max_length=4, validators=[TransactionActions.validator])
    price = models.DecimalField(decimal_places=8, max_digits=15)
    quantity = models.DecimalField(
        decimal_places=8, max_digits=15  # crypto needs a lot of decimal places
    )
    operation_date = models.DateField(default=serializable_today_function)
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="transactions")
    # only useful for selling transactions, as it's used when calculating the ROI
    initial_price = models.DecimalField(decimal_places=6, max_digits=13, blank=True, null=True)
    # the conversion rate between `asset.currency` and `Currencies.real` at `operation_date`
    current_currency_conversion_rate = models.DecimalField(
        decimal_places=2, max_digits=8, blank=True, null=True
    )

    objects = TransactionQuerySet.as_manager()

    def __str__(self) -> str:
        return f"<Transaction {self.action} {self.quantity} {self.asset.code} {self.price}>"  # pragma: no cover

    __repr__ = __str__


class PassiveIncome(models.Model):
    type = models.CharField(max_length=8, validators=[PassiveIncomeTypes.validator])
    event_type = models.CharField(max_length=11, validators=[PassiveIncomeEventTypes.validator])
    amount = models.DecimalField(decimal_places=2, max_digits=12)
    operation_date = models.DateField()
    # the conversion rate between `asset.currency` and `Currencies.real` at `operation_date`
    current_currency_conversion_rate = models.DecimalField(
        decimal_places=2, max_digits=8, blank=True, null=True
    )
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="incomes")

    objects = PassiveIncomeQuerySet.as_manager()

    def __str__(self) -> str:
        return f"<PassiveIncome {self.type} {self.event_type} {self.asset.code} {self.amount}>"  # pragma: no cover

    __repr__ = __str__
