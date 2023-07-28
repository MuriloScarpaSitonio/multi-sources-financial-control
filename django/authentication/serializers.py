from django.contrib.auth import get_user_model, password_validation
from django.db.transaction import atomic
from rest_framework import serializers, validators

from .models import IntegrationSecret


class IntegrationSecretSerializer(serializers.ModelSerializer):
    cpf = serializers.CharField(
        required=False,
        validators=[
            validators.UniqueValidator(
                queryset=IntegrationSecret.objects.all(),
                message="Um usuário com esse CPF já existe.",
            )
        ],
    )

    class Meta:
        model = IntegrationSecret
        fields = (
            "cpf",
            "kucoin_api_key",
            "kucoin_api_secret",
            "kucoin_api_passphrase",
            "binance_api_key",
            "binance_api_secret",
        )

    @staticmethod
    def _validate_kucoin_secrets(
        kucoin_api_key: str | None,
        kucoin_api_secret: str | None,
        kucoin_api_passphrase: str | None,
    ) -> None:
        ERROR = serializers.ValidationError(
            {"kucoin": ["Todos os segredos da KuCoin devem ser nulos ou ter um valor válido."]}
        )

        if kucoin_api_key and (not kucoin_api_secret or not kucoin_api_passphrase):
            raise ERROR

        if kucoin_api_secret and (not kucoin_api_key or not kucoin_api_passphrase):
            raise ERROR

        if kucoin_api_passphrase and (not kucoin_api_key or not kucoin_api_secret):
            raise ERROR

    @staticmethod
    def _validate_binance_secrets(
        binance_api_key: str | None, binance_api_secret: str | None
    ) -> None:
        ERROR = serializers.ValidationError(
            {"binance": ["Todos os segredos da Binance devem ser nulos ou ter um valor válido."]}
        )

        if binance_api_key and not binance_api_secret:
            raise ERROR

        if binance_api_secret and not binance_api_key:
            raise ERROR

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        self._validate_kucoin_secrets(
            kucoin_api_key=attrs.get("kucoin_api_key"),
            kucoin_api_secret=attrs.get("kucoin_api_secret"),
            kucoin_api_passphrase=attrs.get("kucoin_api_passphrase"),
        )
        self._validate_binance_secrets(
            binance_api_key=attrs.get("binance_api_key"),
            binance_api_secret=attrs.get("binance_api_secret"),
        )
        return attrs

    def validate_cpf(self, value: str) -> str:
        ERROR = serializers.ValidationError("CPF inválido")

        def get_cpf_sum(value: str, _range: range) -> int:
            _sum = 0
            for char, i in zip(value, _range):  # noqa: B905
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


class UserSerializer(serializers.ModelSerializer):
    secrets = IntegrationSecretSerializer(required=False, write_only=True)

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "has_cei_integration",
            "has_kucoin_integration",
            "has_binance_integration",
            "secrets",
        )

    @atomic
    def create(self, validated_data: dict[str, str]) -> "UserSerializer.Meta.model":
        if "secrets" in validated_data:
            secrets_serializer = IntegrationSecretSerializer(data=validated_data.pop("secrets"))
            secrets_serializer.is_valid(raise_exception=True)
            validated_data["secrets"] = secrets_serializer.save()

        return super().create(validated_data=validated_data)

    @atomic
    def update(
        self, instance: "UserSerializer.Meta.model", validated_data: dict[str, str | dict[str, str]]
    ) -> "UserSerializer.Meta.model":
        if "secrets" in validated_data:
            secrets_serializer: IntegrationSecretSerializer = self.fields["secrets"]
            secrets_serializer.update(
                instance=instance.secrets, validated_data=validated_data.pop("secrets")
            )

        return super().update(instance=instance, validated_data=validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, min_length=4)
    new_password = serializers.CharField(required=True, min_length=4)
    new_password2 = serializers.CharField(required=True, min_length=4)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "As senhas novas não são iguais"})

        user = self.context["user"]
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"old_password": "A senha antiga está incorreta"})

        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
