from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import IsAuthenticated

if TYPE_CHECKING:
    from rest_framework.request import Request


class InventmentsModulePermission(IsAuthenticated):
    message = "Você não tem acesso ao módulo de investimentos"

    def has_permission(self, request: Request, _) -> bool:
        return super().has_permission(request, _) and request.user.is_investments_module_enabled
