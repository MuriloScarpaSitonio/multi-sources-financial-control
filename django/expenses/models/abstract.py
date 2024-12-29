from django.db import models

from ..choices import Colors


class RelatedEntity(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    name = models.CharField(max_length=100)
    hex_color = models.CharField(max_length=7, validators=[Colors.validator])
    deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=("name", "user"), name="%(class)s__name__user__unique_together"
            )
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"<{self.__class__.__name__} ({self.name} | {self.user_id})>"

    __repr__ = __str__


class RelatedTag(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=("name", "user"), name="%(class)s__name__user__unique_together"
            )
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"<{self.__class__.__name__} ({self.name} | {self.user_id})>"

    __repr__ = __str__
