from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

from tasks.models import TaskHistory

from .integrations.binance.handlers import sync_binance_transactions
from .integrations.kucoin.handlers import sync_kucoin_transactions

if TYPE_CHECKING:
    from collections.abc import Callable

    from rest_framework.request import Request


class _IntegrationPermission(BasePermission):
    property_name: str

    def has_permission(self, request: Request, _) -> bool:
        return getattr(request.user, self.property_name, False)


class BinancePermission(_IntegrationPermission):
    message = "User has not set the given credentials for Binance integration"
    property_name = "has_binance_integration"


class CeiPermission(_IntegrationPermission):
    message = "User has not set the given credentials for CEI integration"
    property_name = "has_cei_integration"


class KuCoinPermission(_IntegrationPermission):
    message = "User has not set the given credentials for KuCoin integration"
    property_name = "has_kucoin_integration"


class _IntegrationTaskRunCheckerPermission(BasePermission):
    message = "User has not set the given credentials for Binance integration"
    task: Callable

    def has_permission(self, request: Request, _) -> bool:
        return not TaskHistory.objects.was_successfully_executed_today(
            name=self.task.name, created_by_id=request.user.pk
        )


class BinanceTaskRunCheckerPermission(_IntegrationTaskRunCheckerPermission):
    message = "Binance sync transactions task was already successfully executed today"
    task = sync_binance_transactions


class KucoinTaskRunCheckerPermission(_IntegrationTaskRunCheckerPermission):
    message = "KuCoin sync transactions task was already successfully executed today"
    task = sync_kucoin_transactions
