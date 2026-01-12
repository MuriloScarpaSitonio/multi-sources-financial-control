from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from shared.models_utils import serializable_today_function

from ..domain.models import Revenue as RevenueDomainModel
from ..managers import RevenueQueryset
from .abstract import RelatedEntity, RelatedTag


class RevenueCategory(RelatedEntity):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="revenue_categories"
    )


class RevenueTag(RelatedTag):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="revenue_tags"
    )


class Revenue(models.Model):
    value = models.DecimalField(
        decimal_places=2, max_digits=18, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(max_length=300)
    created_at = models.DateField(default=serializable_today_function)
    is_fixed = models.BooleanField(default=False)
    recurring_id = models.UUIDField(null=True, blank=True, db_index=True)
    category = models.CharField(max_length=100, default="")
    # needed so we can sort by most common
    expanded_category = models.ForeignKey(
        to=RevenueCategory,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="revenues",
    )
    #
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="revenues"
    )
    bank_account = models.ForeignKey(
        "BankAccount",
        on_delete=models.PROTECT,
        related_name="revenues",
    )

    tags = models.ManyToManyField(to=RevenueTag, blank=True, related_name="revenues")

    objects = RevenueQueryset.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<Revenue ({self.full_description})>"

    __repr__ = __str__

    @property
    def full_description(self) -> str:
        return (
            (
                f"{self.description} "
                + f"({self.created_at.month:02}/{str(self.created_at.year)[2:]})"
            )
            if self.is_fixed
            else self.description
        )

    def to_domain(self) -> RevenueDomainModel:
        return RevenueDomainModel(
            id=self.pk,
            value=self.value,
            created_at=self.created_at,
            description=self.description,
            is_fixed=self.is_fixed,
            recurring_id=self.recurring_id,
            bank_account_id=self.bank_account_id,
        )
