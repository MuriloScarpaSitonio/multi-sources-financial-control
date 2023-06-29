from __future__ import annotations

from decimal import Decimal, DecimalException

from django.db import models
from django.utils.functional import cached_property
from config.settings.dynamic import dynamic_settings

from .managers import AssetReadModelQuerySet
from .write import AssetMetaData
from ..choices import AssetObjectives, AssetSectors, AssetTypes, TransactionCurrencies


class AssetReadModel(models.Model):
    # region: write model fields
    code = models.CharField(max_length=10)
    type = models.CharField(max_length=10, validators=[AssetTypes.custom_validator])
    objective = models.CharField(
        max_length=50,
        validators=[AssetObjectives.custom_validator],
        default=AssetObjectives.unknown,
    )
    user_id = models.PositiveBigIntegerField(editable=False, db_index=True)
    # endregion: write model fields

    write_model_pk = models.PositiveBigIntegerField(editable=False, unique=True, db_index=True)
    currency = models.CharField(
        max_length=6, blank=True, validators=[TransactionCurrencies.custom_validator]
    )
    quantity_balance = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    adjusted_avg_price = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    total_bought = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    total_invested = models.DecimalField(decimal_places=8, max_digits=15, default=Decimal())
    total_invested_adjusted = models.DecimalField(
        decimal_places=8, max_digits=15, default=Decimal()
    )
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.ForeignKey(
        to=AssetMetaData, on_delete=models.DO_NOTHING, related_name="user_read_assets", null=True
    )

    objects = AssetReadModelQuerySet.as_manager()

    def __str__(self) -> str:
        return f"<AssetMetaData ({self.code} | {self.type} | {self.currency} | {self.user_id})>"  # pragma: no cover

    __repr__ = __str__

    @cached_property
    def roi(self) -> Decimal:
        return (self.quantity_balance * self.metadata.current_price) - self.total_invested_adjusted

    @cached_property
    def roi_percentage(self) -> Decimal:
        try:
            return (self.roi / self.total_bought) * Decimal("100.0")
        except DecimalException:
            return Decimal()
