from decimal import Decimal

from shared.models_utils import serializable_today_function

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from ..choices import (
    AssetObjectives,
    AssetSectors,
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from ..domain.models import Asset as AssetDomainModel
from .managers import (
    AssetClosedOperationQuerySet,
    AssetQuerySet,
    PassiveIncomeQuerySet,
    TransactionQuerySet,
)


class AssetMetaData(models.Model):
    code = models.CharField(max_length=200)
    type = models.CharField(max_length=10, validators=[AssetTypes.validator])
    sector = models.CharField(
        max_length=50, validators=[AssetSectors.validator], default=AssetSectors.unknown
    )
    currency = models.CharField(max_length=6, validators=[Currencies.validator])
    current_price = models.DecimalField(decimal_places=10, max_digits=17)
    current_price_updated_at = models.DateTimeField(blank=True, null=True)
    asset = models.OneToOneField(
        to="Asset", on_delete=models.CASCADE, blank=True, null=True, related_name="metadata"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("code", "type", "currency"),
                name="code__type__currency__unique_together",
                condition=models.Q(asset__isnull=True),
            ),
            models.CheckConstraint(
                check=models.Q(asset__isnull=True) | models.Q(type=AssetTypes.fixed_br),
                name="only_fixed_assets_can_have_a_direct_metadata",
            ),
        ]

    def __str__(self) -> str:
        return f"<AssetMetaData ({self.code} | {self.type} | {self.currency})>"  # pragma: no cover

    __repr__ = __str__

    @property
    def is_held_in_self_custody(self) -> bool:
        # é um ativo custodiado pelo banco emissor?
        # (ou seja, aplica-se apenas para renda fixa e  nao pode ser sincronizado pela b3)
        # se sim, entao o ativo (`Asset`) será linkado diretamente com um metadata
        # (`AssetMetadata`)
        return self.asset_id is not None


class Asset(models.Model):
    code = models.CharField(max_length=200)
    description = models.CharField(max_length=100, blank=True, default="")
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

    @property
    def is_held_in_self_custody(self) -> bool:
        # ativos custodiados fora da b3 sao diretamente "conectados"
        # a um metadata
        return hasattr(self, "metadata")

    def to_domain(self) -> AssetDomainModel:
        return AssetDomainModel(
            id=self.pk,
            code=self.code,
            type=self.type,
            objective=self.objective,
            description=self.description,
            currency=self.currency,
            is_held_in_self_custody=self.is_held_in_self_custody,
            # values MUST be already annotated!
            quantity_balance=getattr(self, "quantity_balance", None),
            avg_price=getattr(self, "avg_price", None),
            total_sold=getattr(self, "total_sold", None),
            #
        )


class AssetClosedOperation(models.Model):
    normalized_total_sold = models.DecimalField(
        decimal_places=4, max_digits=20, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    normalized_total_bought = models.DecimalField(
        decimal_places=4, max_digits=20, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    total_bought = models.DecimalField(
        decimal_places=4, max_digits=20, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    quantity_bought = models.DecimalField(
        decimal_places=4, max_digits=20, validators=[MinValueValidator(Decimal("0.0001"))]
    )
    normalized_credited_incomes = models.DecimalField(
        decimal_places=2, max_digits=20, default=Decimal
    )
    credited_incomes = models.DecimalField(decimal_places=2, max_digits=20, default=Decimal)
    operation_datetime = models.DateTimeField()
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="closed_operations")

    objects = AssetClosedOperationQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<AssetClosedOperation ({self.asset} | {self.operation_datetime})>"

    __repr__ = __str__


class Transaction(models.Model):
    external_id = models.CharField(max_length=100, blank=True, default="")
    action = models.CharField(max_length=4, validators=[TransactionActions.validator])
    price = models.DecimalField(decimal_places=8, max_digits=15)
    quantity = models.DecimalField(
        decimal_places=8,
        max_digits=15,  # crypto needs a lot of decimal places
        null=True,  # aitvos de renda fixa nao necessariamente sao
        # "medidos" por meio de quantidades
    )
    operation_date = models.DateField(default=serializable_today_function)
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="transactions")
    # the conversion rate between `asset.currency` and `Currencies.real` at `operation_date`
    current_currency_conversion_rate = models.DecimalField(
        decimal_places=2, max_digits=8, blank=True, default=Decimal("1.0")
    )

    objects = TransactionQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<Transaction {self.action} {self.quantity} {self.asset.code} {self.price}>"

    __repr__ = __str__


class PassiveIncome(models.Model):
    type = models.CharField(max_length=20, validators=[PassiveIncomeTypes.validator])
    event_type = models.CharField(max_length=11, validators=[PassiveIncomeEventTypes.validator])
    amount = models.DecimalField(decimal_places=2, max_digits=12)
    operation_date = models.DateField()
    # the conversion rate between `asset.currency` and `Currencies.real` at `operation_date`
    current_currency_conversion_rate = models.DecimalField(
        decimal_places=2, max_digits=8, blank=True, default=Decimal("1")
    )
    asset = models.ForeignKey(to=Asset, on_delete=models.CASCADE, related_name="incomes")

    objects = PassiveIncomeQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<PassiveIncome {self.type} {self.event_type} {self.asset.code} {self.amount}>"

    __repr__ = __str__
