from django.conf import settings
from django.db import models

from utils.models_utils import serializable_today_function

from .choices import ExpenseCategory, ExpenseSource


class Expense(models.Model):
    price = models.DecimalField(decimal_places=2, max_digits=6)
    description = models.CharField(max_length=300)
    category = models.CharField(choices=ExpenseCategory.choices, max_length=20)
    created_at = models.DateField(default=serializable_today_function)
    source = models.CharField(choices=ExpenseSource.choices, max_length=20)
    is_fixed = models.BooleanField(default=False)
    user = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"<Expense ({self.description})>"
