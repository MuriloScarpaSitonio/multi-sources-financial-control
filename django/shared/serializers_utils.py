from rest_framework import serializers


class CustomChoiceField(serializers.ChoiceField):
    def to_representation(self, obj):
        return self._choices[obj]

    def to_internal_value(self, value: str):
        if value in self._choices:
            return value
        self.fail("invalid_choice", input=value)
