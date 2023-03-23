from decimal import Decimal
from typing import Optional

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
    ASSET_TYPE_CURRENCY_MAP,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
    TransactionCurrencies,
)
from ..domain.models import Asset as AssetDomainModel


class Asset(models.Model):
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, validators=[AssetTypes.custom_validator])
    sector = models.CharField(
        max_length=50, validators=[AssetSectors.custom_validator], default=AssetSectors.unknown
    )
    objective = models.CharField(
        max_length=50,
        validators=[AssetObjectives.custom_validator],
        default=AssetObjectives.unknown,
    )
    current_price = models.DecimalField(decimal_places=6, max_digits=13, blank=True, null=True)
    current_price_updated_at = models.DateTimeField(blank=True, null=True)
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assets",
    )

    objects = AssetQuerySet.as_manager()

    class Meta:
        ordering = ("code",)
        unique_together = ("user", "code")

    def __str__(self) -> str:
        return f"<Asset ({self.code})>"  # pragma: no cover

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
        return self.transactions.get_current_quantity()["quantity"]

    @cached_property
    def currency_from_transactions(self) -> Optional[str]:
        # we are accepting only one currency per asset, but this may change in the future
        return self.transactions.values_list("currency", flat=True).distinct().first()

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
        return AssetDomainModel(
            quantity=self.quantity_from_transactions,
            avg_price=self.avg_price_from_transactions,
            currency=self.currency_from_transactions,
        )


class Transaction(models.Model):
    external_id = models.CharField(max_length=100, blank=True, null=True)
    action = models.CharField(max_length=4, validators=[TransactionActions.custom_validator])
    price = models.DecimalField(decimal_places=8, max_digits=15)
    currency = models.CharField(
        max_length=6,
        validators=[TransactionCurrencies.custom_validator],
        default=TransactionCurrencies.real,
    )
    quantity = models.DecimalField(
        decimal_places=8, max_digits=15  # crypto needs a lot of decimal places
    )
    created_at = models.DateField(default=serializable_today_function)
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="transactions")
    # only useful for selling transactions, as it's used when calculating the ROI
    initial_price = models.DecimalField(decimal_places=6, max_digits=13, blank=True, null=True)
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
    type = models.CharField(max_length=8, validators=[PassiveIncomeTypes.custom_validator])
    event_type = models.CharField(
        max_length=11, validators=[PassiveIncomeEventTypes.custom_validator]
    )
    amount = models.DecimalField(decimal_places=2, max_digits=6)
    operation_date = models.DateField()
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="incomes")
    fetched_by = models.ForeignKey(
        to=TaskHistory, null=True, blank=True, related_name="incomes", on_delete=models.SET_NULL
    )

    objects = PassiveIncomeQuerySet.as_manager()

    class Meta:
        ordering = ("-operation_date", "-amount")

    def __str__(self) -> str:
        return f"<PassiveIncome {self.type} {self.event_type} {self.asset.code} {self.amount}>"  # pragma: no cover

    __repr__ = __str__
