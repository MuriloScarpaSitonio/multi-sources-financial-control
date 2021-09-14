from rest_framework import serializers


class CustomChoiceField(serializers.ChoiceField):
    def to_representation(self, obj):
        return self._choices[obj]

    def to_internal_value(self, data):
        if data in self._choices:
            return data
        self.fail("invalid_choice", input=data)
