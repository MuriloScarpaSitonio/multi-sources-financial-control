from rest_framework import serializers
from django.contrib.auth import get_user_model


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("id", "username", "cpf", "cei_password")

    def validate_cpf(self, value):
        ERROR = serializers.ValidationError("CPF inválido")

        def get_cpf_sum(value, _range):
            _sum = 0
            for char, i in zip(value, _range):
                _sum += int(char) * i
            return _sum

        if len(value) != 11:
            raise ERROR

        if len(set(value)) == 1:
            raise ERROR

        first_digit_sum = get_cpf_sum(value, range(10, 1, -1))
        if int(value[-2]) != (first_digit_sum * 10) % 11:
            raise ERROR

        second_digit_sum = get_cpf_sum(value, range(11, 1, -1))
        if int(value[-1]) != (second_digit_sum * 10) % 11:
            raise ERROR

        return value
