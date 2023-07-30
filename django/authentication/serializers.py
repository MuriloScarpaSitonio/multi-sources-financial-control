from django.contrib.auth import get_user_model, password_validation
from django.db.transaction import atomic

from rest_framework import serializers, validators

from .models import IntegrationSecret
from .utils import token_generator

UserModel = get_user_model()


class IntegrationSecretSerializer(serializers.ModelSerializer):
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
        extra_kwargs = {
            "cpf": {
                "validators": [
                    validators.UniqueValidator(
                        queryset=IntegrationSecret.objects.all(),
                        message="Um usuário com esse CPF já existe",
                    )
                ]
            }
        }

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
        model = UserModel
        fields = (
            "id",
            "username",
            "email",
            "has_cei_integration",
            "has_kucoin_integration",
            "has_binance_integration",
            "secrets",
        )
        extra_kwargs = {
            "email": {
                "validators": [
                    validators.UniqueValidator(
                        queryset=UserModel.objects.all(),
                        message="Um usuário com esse email já existe",
                    )
                ]
            }
        }

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


class _ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, min_length=4)
    new_password2 = serializers.CharField(required=True, min_length=4)

    @property
    def user(self) -> UserModel:
        return self.context["user"]

    def validate_new_password(self, value: str) -> str:
        password_validation.validate_password(value, self.user)
        return value

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "As senhas não são iguais"})

        return attrs

    def save(self) -> UserModel:
        self.user.set_password(self.validated_data["new_password"])
        self.user.save(update_fields=("password",))
        return self.user


class _TokenSerializer(serializers.Serializer):
    token = serializers.CharField()

    @property
    def user(self) -> UserModel:
        return self.context["user"]

    def validate_token(self, value: str) -> str:
        if not token_generator.check_token(
            user=self.user, token=value, expire=self.context.get("token_expires", True)
        ):
            raise serializers.ValidationError("Token inválido")


class ResetPasswordSerializer(_TokenSerializer, _ResetPasswordSerializer):
    ...


class ChangePasswordSerializer(_ResetPasswordSerializer):
    old_password = serializers.CharField(required=True, min_length=4)

    def validate_old_password(self, value: str) -> str:
        if not self.user.check_password(value):
            raise serializers.ValidationError("A senha antiga está incorreta")
        return value


class ActivateUserSerializer(_TokenSerializer):
    def save(self) -> UserModel:
        self.user.is_active = True
        self.user.save(update_fields=("is_active",))
        return self.user


class ResetPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
