from __future__ import annotations

from typing import Self

from django.contrib.auth.models import UserManager

from .choices import SubscriptionStatus


class CustomUserManager(UserManager):
    def filter_personal_finances_active(self) -> Self:
        return self.filter(
            is_personal_finances_module_enabled=True, subscription_status=SubscriptionStatus.ACTIVE
        )

    def filter_investments_module_active(self):
        return self.filter(
            is_investments_module_enabled=True,
            subscription_status__in=(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING),
        )

    def filter_investments_integrations_active(self) -> Self:
        return self.filter(
            is_investments_integrations_module_enabled=True,
            subscription_status__in=(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING),
        )

    def filter_kucoin_integration_active(self) -> Self:
        return self.filter_investments_integrations_active().filter(
            secrets__kucoin_api_key__isnull=False
        )

    def filter_binance_integration_active(self) -> Self:
        return self.filter_investments_integrations_active().filter(
            secrets__binance_api_key__isnull=False
        )
