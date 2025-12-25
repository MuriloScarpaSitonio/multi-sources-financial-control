from django.conf import settings
from django.db import models

from shared.models_utils import serializable_today_function

from ..managers import BankAccountSnapshotQuerySet


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
