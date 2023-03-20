from __future__ import annotations

from decimal import Decimal

from django.db import models

from config.settings.dynamic import dynamic_settings

from .managers import AssetReadModelQuerySet
from ..choices import AssetObjectives, AssetSectors, AssetTypes, TransactionCurrencies


class AssetReadModel(models.Model):
    # region: write model fields
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
    current_price = models.DecimalField(decimal_places=6, max_digits=13)
    current_price_updated_at = models.DateTimeField(blank=True, null=True)
    user_id = models.PositiveBigIntegerField(editable=False, db_index=True)
    # endregion: write model fields

    write_model_pk = models.PositiveBigIntegerField(editable=False, unique=True, db_index=True)
    currency = models.CharField(
        max_length=6, blank=True, validators=[TransactionCurrencies.custom_validator]
    )
    quantity_balance = models.DecimalField(decimal_places=8, max_digits=15)
    avg_price = models.DecimalField(decimal_places=8, max_digits=15)
    adjusted_avg_price = models.DecimalField(decimal_places=8, max_digits=15)
    roi = models.DecimalField(decimal_places=8, max_digits=15)
    roi_percentage = models.DecimalField(decimal_places=8, max_digits=15)
    total_invested = models.DecimalField(decimal_places=8, max_digits=15)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AssetReadModelQuerySet.as_manager()

    def __str__(self) -> str:
        return f"<AssetReadModel ({self.code})>"  # pragma: no cover

    __repr__ = __str__

    @property
    def current_total(self):
        total = self.current_price * self.quantity_balance
        return (
            total
            if self.currency == TransactionCurrencies.real
            else total * dynamic_settings.DOLLAR_CONVERSION_RATE
        )
