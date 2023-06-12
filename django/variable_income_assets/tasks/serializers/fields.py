from datetime import date, datetime, timezone

from rest_framework.serializers import ChoiceField, Field


class TimeStampToDateField(Field):
    def to_internal_value(self, value: int) -> date:
        return datetime.fromtimestamp(value, tz=timezone.utc).date()

    def to_representation(self, value: int) -> int:
        return value


class CeiTransactionChoiceField(ChoiceField):
    def to_internal_value(self, value: str) -> str:  # pragma: no cover
        if value.upper() in self.choice_strings_to_values:
            return value
        self.fail("invalid_choice", input=value)


class CeiPassiveIncomeChoiceField(ChoiceField):
    def to_internal_value(self, value: str) -> str:  # pragma: no cover
        value = value.upper()
        if value in self.choice_strings_to_values:
            return value
        self.fail("invalid_choice", input=value)
