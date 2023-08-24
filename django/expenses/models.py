from django.conf import settings
from django.db import models

from shared.models_utils import serializable_today_function

from .choices import ExpenseCategory, ExpenseSource
from .managers import ExpenseQueryset


class Expense(models.Model):
    price = models.DecimalField(decimal_places=2, max_digits=6)
    description = models.CharField(max_length=300)
    category = models.CharField(validators=[ExpenseCategory.validator], max_length=20)
    created_at = models.DateField(default=serializable_today_function)
    source = models.CharField(validators=[ExpenseSource.validator], max_length=20)
    is_fixed = models.BooleanField(default=False)
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses",
    )

    objects = ExpenseQueryset.as_manager()

    class Meta:
        ordering = ("-created_at", "-pk")

    def __str__(self) -> str:  # pragma: no cover
        return f"<Expense ({self.full_description})>"

    __repr__ = __str__

    @property
    def full_description(self) -> str:
        return (
            self.description
            if not self.is_fixed
            else (
                f"{self.description} "
                + f"({self.created_at.month:02}/{str(self.created_at.year)[2:]})"
            )
        )
