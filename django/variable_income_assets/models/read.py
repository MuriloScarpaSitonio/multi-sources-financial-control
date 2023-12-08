from __future__ import annotations

from decimal import Decimal, DecimalException

from django.db import models
from django.utils.functional import cached_property

from ..adapters.key_value_store import get_dollar_conversion_rate
from ..choices import AssetObjectives, AssetTypes, Currencies
from .managers import AssetReadModelQuerySet
from .write import AssetMetaData


class AssetReadModel(models.Model):
    # region: write model fields
    code = models.CharField(max_length=10)
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
    quantity_balance = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    adjusted_avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
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
    def roi_percentage(self) -> Decimal:
        # TODO: move to db so ordering can work
        try:
            return (self.normalized_roi / self.normalized_total_bought) * Decimal("100.0")
        except DecimalException:
            return Decimal()

    @cached_property
    def adjusted_avg_price(self) -> Decimal:
        try:
            return (
                (self.quantity_balance * self.avg_price) - self.credited_incomes
            ) / self.quantity_balance
        except DecimalException:
            return Decimal()
