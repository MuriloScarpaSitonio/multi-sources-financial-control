from datetime import date, datetime

from django.utils.timezone import utc

from rest_framework.serializers import ChoiceField, Field


class TimeStampToDateField(Field):
    def to_internal_value(self, value: int) -> date:
        return datetime.fromtimestamp(value, tz=utc).date()

    def to_representation(self, value: int) -> int:
        return value


class CeiTransactionChoiceField(ChoiceField):
    def to_internal_value(self, value: str) -> str:
        if value.upper() in self.choice_strings_to_values:
            return value
        self.fail("invalid_choice", input=value)


class CeiPassiveIncomeChoiceField(ChoiceField):
    def to_internal_value(self, value: str) -> str:
        value = value.upper()
        if value in self.choice_strings_to_values:
            return value
        self.fail("invalid_choice", input=value)
