from django.contrib.auth.models import AbstractUser
from django.db import models

from .fields import EncryptedField


class IntegrationSecret(models.Model):
    # do not encrypt cpf as it won't be unique
    cpf = models.CharField(max_length=14, null=True, blank=True, unique=True)
    cei_password = EncryptedField(null=True, blank=True)
    kucoin_api_key = EncryptedField(null=True, blank=True)
    kucoin_api_secret = EncryptedField(null=True, blank=True)
    kucoin_api_passphrase = EncryptedField(null=True, blank=True)
    binance_api_key = EncryptedField(null=True, blank=True)
    binance_api_secret = EncryptedField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(models.Q(cpf__isnull=True) & models.Q(cei_password__isnull=True))
                | (models.Q(cpf__isnull=False) & models.Q(cei_password__isnull=False)),
                name="cei_secrets_all_null_or_all_filled",
            ),
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
        return f"<IntegrationSecret ({self.user_id})>"


class CustomUser(AbstractUser):
    secrets = models.OneToOneField(
        IntegrationSecret, on_delete=models.CASCADE, null=True, blank=True, related_name="user"
    )

    @property
    def has_cei_integration(self) -> bool:
        return (
            self.secrets is not None
            and self.secrets.cei_password is not None
            and self.secrets.cpf is not None
        )

    @property
    def has_kucoin_integration(self) -> bool:
        return (
            self.secrets is not None
            and self.secrets.kucoin_api_key is not None
            and self.secrets.kucoin_api_secret is not None
            and self.secrets.kucoin_api_passphrase is not None
        )

    @property
    def has_binance_integration(self) -> bool:
        return (
            self.secrets is not None
            and self.secrets.binance_api_key is not None
            and self.secrets.binance_api_secret is not None
        )

    def __str__(self) -> str:
        return f"<CustomUser ({self.username} | {self.email})>"
