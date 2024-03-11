from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .choices import SubscriptionStatus
from .fields import EncryptedField
from .managers import CustomUserManager


class IntegrationSecret(models.Model):
    # do not encrypt cpf as it won't be unique
    cpf = models.CharField(max_length=14, null=True, blank=True, unique=True)
    kucoin_api_key = EncryptedField(null=True, blank=True)
    kucoin_api_secret = EncryptedField(null=True, blank=True)
    kucoin_api_passphrase = EncryptedField(null=True, blank=True)
    binance_api_key = EncryptedField(null=True, blank=True)
    binance_api_secret = EncryptedField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(kucoin_api_key__isnull=True)
                    & models.Q(kucoin_api_secret__isnull=True)
                    & models.Q(kucoin_api_passphrase__isnull=True)
                )
                | (
                    models.Q(kucoin_api_key__isnull=False)
                    & models.Q(kucoin_api_secret__isnull=False)
                    & models.Q(kucoin_api_passphrase__isnull=False)
                ),
                name="kucoin_secrets_all_null_or_all_filled",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(binance_api_key__isnull=True)
                    & models.Q(binance_api_secret__isnull=True)
                )
                | (
                    models.Q(binance_api_key__isnull=False)
                    & models.Q(binance_api_secret__isnull=False)
                ),
                name="binance_secrets_all_null_or_all_filled",
            ),
        ]

    def __str__(self) -> str:
        return f"<IntegrationSecret ({self.user})>"

    __repr__ = __str__


class CustomUser(AbstractUser):
    secrets = models.OneToOneField(
        IntegrationSecret, on_delete=models.CASCADE, null=True, blank=True, related_name="user"
    )
    username = models.CharField(max_length=150)
    email = models.EmailField(unique=True, db_index=True)
    is_active = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(
        max_length=40, null=True, blank=True, unique=True, db_index=True
    )
    stripe_subscription_id = models.CharField(max_length=40, null=True, blank=True, unique=True)
    stripe_subscription_updated_at = models.DateTimeField(null=True, blank=True)
    subscription_ends_at = models.DateTimeField(null=True, blank=True)
    subscription_status = models.CharField(
        choices=SubscriptionStatus.choices, default=SubscriptionStatus.INACTIVE, max_length=25
    )
    has_default_payment_method = models.BooleanField(default=False)
    is_personal_finances_module_enabled = models.BooleanField(default=False)
    is_investments_module_enabled = models.BooleanField(default=False)
    is_investments_integrations_module_enabled = models.BooleanField(default=False)
    credit_card_bill_day = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(31)]
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = CustomUserManager()

    class Meta:
        constraints = [
            # models.CheckConstraint(
            #     check=(models.Q(cpf__isnull=True) & models.Q(cei_password__isnull=True))
            #     | (models.Q(cpf__isnull=False) & models.Q(cei_password__isnull=False)),
            #     name="cei_secrets_all_null_or_all_filled",
            # ),
            # models.CheckConstraint(
            #     check=(
            #         models.Q(kucoin_api_key__isnull=True)
            #         & models.Q(kucoin_api_secret__isnull=True)
            #         & models.Q(kucoin_api_passphrase__isnull=True)
            #     )
            #     | (
            #         models.Q(kucoin_api_key__isnull=False)
            #         & models.Q(kucoin_api_secret__isnull=False)
            #         & models.Q(kucoin_api_passphrase__isnull=False)
            #     ),
            #     name="kucoin_secrets_all_null_or_all_filled",
            # ),
            # models.CheckConstraint(
            #     check=(
            #         models.Q(binance_api_key__isnull=True)
            #         & models.Q(binance_api_secret__isnull=True)
            #     )
            #     | (
            #         models.Q(binance_api_key__isnull=False)
            #         & models.Q(binance_api_secret__isnull=False)
            #     ),
            #     name="binance_secrets_all_null_or_all_filled",
            # ),
            models.CheckConstraint(
                check=~models.Q(
                    is_investments_module_enabled=False,
                    is_investments_integrations_module_enabled=True,
                ),
                name="investments_integrations_module_cant_be_enabled_alone",
            )
        ]

    @property
    def has_cei_integration(self) -> bool:
        return self.secrets is not None and self.secrets.cpf is not None

    @property
    def has_kucoin_integration(self) -> bool:
        return self.secrets is not None and self.secrets.kucoin_api_key is not None

    @property
    def has_binance_integration(self) -> bool:
        return self.secrets is not None and self.secrets.binance_api_key is not None

    def __str__(self) -> str:
        return f"<CustomUser ({self.username} | {self.email})>"

    __repr__ = __str__
