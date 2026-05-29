from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.transaction import atomic
from django.utils import timezone

from dateutil.relativedelta import relativedelta
from rest_framework import serializers, validators

from .choices import SubscriptionStatus
from .models import IntegrationSecret
from .services.token_generator import token_generator

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


class PlanningPreferencesSerializer(serializers.Serializer):
    selected_method = serializers.ChoiceField(
        choices=[
            "fire",
            "dividends_only",
            "constant_withdrawal",
            "one_over_n",
            "vpw",
        ],
        required=False,
    )
    show_galeno = serializers.BooleanField(required=False, default=False)
    show_age_in_bonds = serializers.BooleanField(required=False)

    class FirePreferencesSerializer(serializers.Serializer):
        withdrawal_rate = serializers.FloatField(
            required=False,
            min_value=2,
            max_value=6,
        )
        target_years = serializers.IntegerField(
            required=False,
            min_value=20,
            max_value=80,
        )
        monthly_expenses_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )
        exclude_ifix_from_sim = serializers.BooleanField(required=False)

    fire = FirePreferencesSerializer(required=False)

    class DividendsOnlyPreferencesSerializer(serializers.Serializer):
        yield_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=1,
            max_value=15,
        )
        monthly_savings_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )
        monthly_expenses_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )

    dividends_only = DividendsOnlyPreferencesSerializer(required=False)

    class OneOverNPreferencesSerializer(serializers.Serializer):
        target_depletion_age = serializers.IntegerField(
            required=False,
            min_value=70,
            max_value=105,
        )
        real_return = serializers.FloatField(
            required=False,
            min_value=1,
            max_value=8,
        )
        monthly_savings_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )
        monthly_expenses_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )

    one_over_n = OneOverNPreferencesSerializer(required=False)

    class VPWPreferencesSerializer(serializers.Serializer):
        target_age = serializers.IntegerField(
            required=False,
            min_value=70,
            max_value=105,
        )
        stock_return = serializers.FloatField(
            required=False,
            min_value=3,
            max_value=15,
        )
        bond_return = serializers.FloatField(
            required=False,
            min_value=1,
            max_value=8,
        )
        stock_allocation_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
            max_value=100,
        )
        monthly_savings_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )
        monthly_expenses_override = serializers.FloatField(
            required=False,
            allow_null=True,
            min_value=0,
        )

    vpw = VPWPreferencesSerializer(required=False)


class UserSerializer(serializers.ModelSerializer):
    secrets = IntegrationSecretSerializer(required=False, write_only=True)
    password2 = serializers.CharField(required=False, write_only=True, min_length=4)
    trial_will_end_message = serializers.SerializerMethodField()
    planning_preferences = PlanningPreferencesSerializer(required=False)

    class Meta:
        model = UserModel
        fields = (
            "id",
            "password",
            "password2",
            "username",
            "email",
            "has_cei_integration",
            "has_kucoin_integration",
            "has_binance_integration",
            "secrets",
            "trial_will_end_message",
            "is_personal_finances_module_enabled",
            "is_investments_module_enabled",
            "is_investments_integrations_module_enabled",
            "subscription_status",
            "stripe_subscription_updated_at",
            "credit_card_bill_day",
            "planning_preferences",
            "date_of_birth",
        )
        extra_kwargs = {
            "email": {
                "validators": [
                    validators.UniqueValidator(
                        queryset=UserModel.objects.all(),
                        message="Um usuário com esse email já existe",
                    )
                ]
            },
            "password": {"write_only": True, "required": False},
            "is_personal_finances_module_enabled": {"read_only": True},
            "is_investments_module_enabled": {"read_only": True},
            "is_investments_integrations_module_enabled": {"read_only": True},
            "subscription_status": {"read_only": True},
            "stripe_subscription_updated_at": {"read_only": True},
            # "credit_card_bill_day": {"write_only": True},
        }

    def get_trial_will_end_message(self, user: UserModel) -> str | None:
        delta = relativedelta(user.subscription_ends_at, timezone.localtime())
        if (
            delta.days <= 3
            and user.subscription_status == SubscriptionStatus.TRIALING
            and not user.has_default_payment_method
        ):
            return (
                f"O período de testes termina em {delta.days} dia(s)"
                if delta.days
                else f"O período de testes termina em {delta.hours} hora(s)"
            )

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if not self.instance:
            if "password" not in attrs or "password2" not in attrs:
                raise serializers.ValidationError({"password": "A senha é obrigatória"})
            if attrs["password"] != attrs["password2"]:
                raise serializers.ValidationError({"password": "As senhas não são iguais"})

        return attrs

    @atomic
    def create(self, validated_data: dict[str, str]) -> UserModel:
        if "secrets" in validated_data:
            secrets_serializer = IntegrationSecretSerializer(data=validated_data.pop("secrets"))
            secrets_serializer.is_valid(raise_exception=True)
            validated_data["secrets"] = secrets_serializer.save()

        validated_data.pop("password2")
        password = validated_data.pop("password")
        user: UserModel = super().create(  # type: ignore
            validated_data={
                **validated_data,
                "email": UserModel.objects.normalize_email(validated_data["email"]),
            }
        )
        try:
            password_validation.validate_password(password, user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": serializers.get_error_detail(e)}) from e

        user.set_password(password)
        user.save(update_fields=("password",))
        return user

    @atomic
    def update(
        self, instance: UserModel, validated_data: dict[str, str | dict[str, str]]
    ) -> UserModel:
        if "secrets" in validated_data:
            secrets_serializer: IntegrationSecretSerializer = self.fields["secrets"]
            secrets_serializer.update(
                instance=instance.secrets, validated_data=validated_data.pop("secrets")
            )

        if "planning_preferences" in validated_data:
            incoming_preferences = validated_data["planning_preferences"]
            current_preferences = instance.planning_preferences or {}
            merged = {
                **current_preferences,
                **incoming_preferences,
            }
            strategy_preference_keys = ("fire", "dividends_only", "one_over_n", "vpw")
            for key in strategy_preference_keys:
                if key in incoming_preferences:
                    current_nested = current_preferences.get(key) or {}
                    if not isinstance(current_nested, dict):
                        current_nested = {}
                    merged[key] = {
                        **current_nested,
                        **incoming_preferences[key],
                    }
            invalid_strategy_keys = [
                key
                for key in strategy_preference_keys
                if key in incoming_preferences and key != merged.get("selected_method")
            ]
            if invalid_strategy_keys:
                message = (
                    "Parâmetros de simulação só podem ser salvos para a "
                    "estratégia selecionada."
                )
                raise serializers.ValidationError(
                    {
                        "planning_preferences": dict.fromkeys(
                            invalid_strategy_keys,
                            message,
                        )
                    }
                )
            if merged.get("show_galeno") and merged.get("selected_method") not in (
                "fire",
                "constant_withdrawal",
                "one_over_n",
                "vpw",
            ):
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_galeno": (
                                "Galeno só pode ser ativado com FIRE, Retirada constante, "
                                "Retirada 1/N ou VPW."
                            )
                        }
                    }
                )
            if merged.get("show_galeno") and "selected_method" not in merged:
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_galeno": "Selecione uma estratégia antes de ativar o Galeno."
                        }
                    }
                )
            if merged.get("show_age_in_bonds") and merged.get("selected_method") not in (
                "fire",
                "constant_withdrawal",
            ):
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_age_in_bonds": (
                                "Idade em RF só pode ser ativado com Regra dos X% ou "
                                "Retirada constante."
                            )
                        }
                    }
                )
            if merged.get("show_age_in_bonds") and merged.get("show_galeno"):
                raise serializers.ValidationError(
                    {
                        "planning_preferences": {
                            "show_age_in_bonds": (
                                "Idade em RF e Galeno não podem ser ativados ao mesmo tempo."
                            )
                        }
                    }
                )
            validated_data["planning_preferences"] = merged

        validated_data.pop("password", None)
        validated_data.pop("password2", None)
        return super().update(instance=instance, validated_data=validated_data)


class _ResetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(required=True, min_length=4)
    password2 = serializers.CharField(required=True, min_length=4)

    @property
    def user(self) -> UserModel:
        return self.context["user"]

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "As senhas não são iguais"})

        return attrs

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value, self.user)
        return value

    def save(self) -> UserModel:
        self.user.set_password(self.validated_data["password"])
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


class ResetPasswordSerializer(_TokenSerializer, _ResetPasswordSerializer): ...


class ChangePasswordSerializer(_ResetPasswordSerializer):
    old_password = serializers.CharField(required=True, min_length=4)

    def validate_old_password(self, value: str) -> str:
        if not self.user.check_password(value):
            raise serializers.ValidationError("A senha antiga está incorreta")
        return value


class ActivateUserSerializer(_TokenSerializer): ...


class ResetPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True, error_messages={"invalid": "Formato de e-mail inválido"}
    )


class StripeCheckoutSessionSerializer(serializers.Serializer):
    price_id = serializers.CharField()
