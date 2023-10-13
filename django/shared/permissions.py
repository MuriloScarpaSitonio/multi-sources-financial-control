from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils import timezone

from rest_framework.permissions import IsAuthenticated

if TYPE_CHECKING:
    from rest_framework.request import Request


class SubscriptionEndedPermission(IsAuthenticated):
    message = "Sua assinatura expirou"

    def has_permission(self, request: Request, _) -> bool:
        return (
            super().has_permission(request, _)
            and request.user.subscription_ends_at >= timezone.localtime()
        )
