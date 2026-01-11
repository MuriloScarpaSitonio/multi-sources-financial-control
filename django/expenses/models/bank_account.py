from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from shared.models_utils import serializable_today_function

from ..managers import BankAccountQuerySet, BankAccountSnapshotQuerySet


class BankAccount(models.Model):
    amount = models.DecimalField(decimal_places=2, max_digits=18)
    description = models.CharField(max_length=300)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    credit_card_bill_day = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
    )
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bank_accounts",
    )

    objects = BankAccountQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "description"),
                condition=models.Q(is_active=True),
                name="unique_bank_account_description_per_user",
            ),
            models.UniqueConstraint(
                fields=("user",),
                condition=models.Q(is_default=True),
                name="unique_default_bank_account_per_user",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"<BankAccount ({self.description} | {self.user_id})>"

    __repr__ = __str__


class BankAccountSnapshot(models.Model):
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bank_account_snapshots",
    )
    operation_date = models.DateField(default=serializable_today_function)
    total = models.DecimalField(decimal_places=4, max_digits=20)

    objects = BankAccountSnapshotQuerySet.as_manager()

    def __str__(self) -> str:  # pragma: no cover
        return f"<BankAccountSnapshot ({self.user_id} | {self.operation_date} | {self.total})>"

    __repr__ = __str__
