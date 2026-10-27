from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible


@deconstructible
class ChoicesValidator:
    """Preserve validator-only fields and their historical migration behavior."""

    def __init__(self, values):
        self.values = values

    def __call__(self, value):
        if value not in self.values:
            raise ValidationError(
                f"Select a valid choice. {value} is not one of the available choices."
            )

    def __eq__(self, other):
        return isinstance(other, ChoicesValidator) and self.values == other.values
