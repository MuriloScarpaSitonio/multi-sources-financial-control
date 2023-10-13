from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import IsAuthenticated

if TYPE_CHECKING:
    from rest_framework.request import Request


class PersonalFinancesModulePermission(IsAuthenticated):
    message = "Você não tem acesso ao módulo de finanças pessoais"

    def has_permission(self, request: Request, _) -> bool:
        return (
            super().has_permission(request, _) and request.user.is_personal_finances_module_enabled
        )
