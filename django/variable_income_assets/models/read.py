from __future__ import annotations

from decimal import Decimal, DecimalException

from django.conf import settings
from django.db import models
from django.utils.functional import cached_property

from shared.models_utils import serializable_today_function

from ..adapters.key_value_store import get_dollar_conversion_rate
from ..choices import AssetObjectives, AssetTypes, Currencies, LiquidityTypes
from .managers import AssetReadModelQuerySet, AssetsTotalInvestedSnapshotQuerySet
from .write import AssetMetaData


class AssetReadModel(models.Model):
    # region: write model fields
    code = models.CharField(max_length=200)
    description = models.CharField(max_length=100, blank=True, default="")
    type = models.CharField(max_length=10, validators=[AssetTypes.validator])
    objective = models.CharField(
        max_length=50,
        validators=[AssetObjectives.validator],
        default=AssetObjectives.unknown,
    )
    user_id = models.PositiveBigIntegerField(editable=False, db_index=True)
    # endregion: write model fields

    write_model_pk = models.PositiveBigIntegerField(editable=False, unique=True, db_index=True)
    currency = models.CharField(max_length=6, blank=True, validators=[Currencies.validator])
    liquidity_type = models.CharField(
        max_length=20, validators=[LiquidityTypes.validator], default="", blank=True
    )
    maturity_date = models.DateField(null=True, blank=True)
    quantity_balance = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    normalized_avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    normalized_total_bought = models.DecimalField(
        decimal_places=4, max_digits=20, default=Decimal()
    )
    normalized_total_sold = models.DecimalField(decimal_places=4, max_digits=20, default=Decimal())
    normalized_closed_roi = models.DecimalField(decimal_places=4, max_digits=20, default=Decimal())
    credited_incomes = models.DecimalField(decimal_places=4, max_digits=20, default=Decimal())
    normalized_credited_incomes = models.DecimalField(
        decimal_places=4, max_digits=20, default=Decimal()
    )
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.ForeignKey(
        to=AssetMetaData,
        on_delete=models.SET_NULL,
        related_name="user_read_assets",
        null=True,
        blank=True,
    )

    objects = AssetReadModelQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<AssetReadModel ({self.code} | {self.type} | {self.currency} | {self.user_id})>"

    __repr__ = __str__

    @property
    def is_held_in_self_custody(self) -> bool:
        # ativos custodiados fora da b3 sao diretamente "conectados"
        # a um metadata
        return bool(self.metadata.asset_id)

    @cached_property
    def normalized_roi(self) -> Decimal:
        current_price = (
            self.metadata.current_price
            if self.currency == Currencies.real
            else self.metadata.current_price * get_dollar_conversion_rate()
        )

        return (current_price * self.quantity_balance) - (
            self.normalized_total_bought
            - self.normalized_credited_incomes
            - self.normalized_total_sold
        )

    @cached_property
    def adjusted_avg_price(self) -> Decimal:
        try:
            return (
                (self.quantity_balance * self.avg_price) - self.credited_incomes
            ) / self.quantity_balance
        except DecimalException:
            return Decimal()


class AssetsTotalInvestedSnapshot(models.Model):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="asset_total_invested_snapshots",
    )
    operation_date = models.DateField(default=serializable_today_function)
    total = models.DecimalField(decimal_places=4, max_digits=20)

    objects = AssetsTotalInvestedSnapshotQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return (
            f"<AssetsTotalInvestedSnapshot ({self.user_id} | {self.operation_date} | {self.total})>"
        )

    __repr__ = __str__
