from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from shared.models_utils import serializable_today_function

from .choices import ExpenseCategory, ExpenseSource
from .domain.models import Expense as ExpenseDomainModel
from .managers import ExpenseQueryset, RevenueQueryset


class Expense(models.Model):
    value = models.DecimalField(
        decimal_places=2, max_digits=18, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(max_length=300)
    category = models.CharField(validators=[ExpenseCategory.validator], max_length=20)
    created_at = models.DateField(default=serializable_today_function)
    source = models.CharField(validators=[ExpenseSource.validator], max_length=20)
    is_fixed = models.BooleanField(default=False)
    installments_id = models.UUIDField(null=True, blank=True)
    installment_number = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1)]
    )
    installments_qty = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(2)]
    )
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses"
    )

    objects = ExpenseQueryset.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
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
                check=(
                    models.Q(is_fixed=True, installments_id__isnull=True) | models.Q(is_fixed=False)
                ),
                name="fixed_expense_must_not_have_installments",
            ),
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
        )


class Revenue(models.Model):
    value = models.DecimalField(
        decimal_places=2, max_digits=18, validators=[MinValueValidator(Decimal("0.01"))]
    )
    description = models.CharField(max_length=300)
    created_at = models.DateField(default=serializable_today_function)
    is_fixed = models.BooleanField(default=False)
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="revenues"
    )

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


class BankAccount(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=18)
    description = models.CharField(max_length=300)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.OneToOneField(
        to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bank_account"
    )

    def __str__(self) -> str:  # pragma: no cover
        return f"<BankAccount ({self.description} | {self.user_id})>"

    __repr__ = __str__
