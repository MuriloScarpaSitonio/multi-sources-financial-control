from django.conf import settings
from django.db import models

from shared.models_utils import serializable_today_function

from .managers import RevenueQueryset


class Revenue(models.Model):
    value = models.DecimalField(decimal_places=2, max_digits=10)
    description = models.CharField(max_length=300)
    created_at = models.DateField(default=serializable_today_function)
    user = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="revenues",
    )

    objects = RevenueQueryset.as_manager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:  # pragma: no cover
        return f"<Revenue ({self.description} at {self.created_at})>"

    __repr__ = __str__
