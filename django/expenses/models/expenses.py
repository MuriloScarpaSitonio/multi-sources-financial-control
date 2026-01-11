from decimal import Decimal

from shared.models_utils import serializable_today_function

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from ..domain.models import Expense as ExpenseDomainModel
from ..managers import ExpenseQueryset
from .abstract import RelatedEntity, RelatedTag


class ExpenseCategory(RelatedEntity):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expense_categories"
    )


class ExpenseSource(RelatedEntity):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expense_sources"
    )


class ExpenseTag(RelatedTag):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expense_tags"
    )


class Expense(models.Model):
    value = models.DecimalField(
        decimal_places=2, max_digits=18, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(max_length=300)
    category = models.CharField(max_length=100)
    created_at = models.DateField(default=serializable_today_function)
    source = models.CharField(max_length=100)
    is_fixed = models.BooleanField(default=False)
    recurring_id = models.UUIDField(null=True, blank=True, db_index=True)
    installments_id = models.UUIDField(null=True, blank=True, db_index=True)
    installment_number = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    installments_qty = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(2)]
    )
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses"
    )
    bank_account = models.ForeignKey(
        "BankAccount",
        on_delete=models.PROTECT,
        related_name="expenses",
        null=True,  # Initially nullable for migration
    )

    # needed so we can sort by most common
    expanded_category = models.ForeignKey(
        to=ExpenseCategory,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="expenses",
    )
    expanded_source = models.ForeignKey(
        to=ExpenseSource,
        blank=True,
        null=True,
        on_delete=models.SET_NULL,
        related_name="expenses",
    )
    #

    tags = models.ManyToManyField(to=ExpenseTag, blank=True, related_name="expenses")

    objects = ExpenseQueryset.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(installments_id__isnull=True)
                    & models.Q(installment_number__isnull=True)
                    & models.Q(installments_qty__isnull=True)
                )
                | (
                    models.Q(installments_id__isnull=False)
                    & models.Q(installment_number__isnull=False)
                    & models.Q(installments_qty__isnull=False)
                ),
                name="installment_values_all_null_or_all_filled",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(is_fixed=True, installments_id__isnull=True) | models.Q(is_fixed=False)
                ),
                name="fixed_expense_must_not_have_installments",
            ),
            # models.CheckConstraint(
            #     condition=(
            #         models.Q(is_fixed=True, recurring_id__isnull=False)
            #         | models.Q(is_fixed=False, recurring_id__isnull=True)
            #     ),
            #     name="fixed_expense_must_have_recurring_id",
            # ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"<Expense ({self.full_description})>"

    __repr__ = __str__

    @property
    def full_description(self) -> str:
        if self.is_fixed:
            description = (
                f"{self.description} "
                + f"({self.created_at.month:02}/{str(self.created_at.year)[2:]})"
            )
        elif self.installments_id is not None:
            description = f"{self.description} ({self.installment_number}/{self.installments_qty})"
        else:
            description = self.description
        return description

    def to_domain(self, include_installments: bool = True) -> ExpenseDomainModel:
        return ExpenseDomainModel(
            id=self.pk,
            description=self.description,
            value=self.value,
            created_at=self.created_at,
            source=self.source,
            category=self.category,
            recurring_id=self.recurring_id,
            installments_qty=self.installments_qty or 1,
            installments_id=self.installments_id,
            installments=(
                [
                    e.to_domain(include_installments=False)  # avoid recursion
                    for e in self.__class__.objects.filter(
                        installments_id=self.installments_id
                    ).exclude(pk=self.pk)
                ]
                if self.installments_id and include_installments
                else []
            ),
            extra_data={
                "expanded_category_id": self.expanded_category_id,
                "expanded_source_id": self.expanded_source_id,
                "bank_account_id": self.bank_account_id,
            },
        )
