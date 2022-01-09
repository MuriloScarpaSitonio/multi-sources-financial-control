from datetime import date, datetime

from django.utils.timezone import utc

from rest_framework.serializers import Field


class TimeStampToDateField(Field):
    def to_internal_value(self, value: int) -> date:
        return datetime.fromtimestamp(value, tz=utc).date()

    def to_representation(self, value):
        return value
