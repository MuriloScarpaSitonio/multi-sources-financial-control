from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request

from django.contrib.auth.views import (
    INTERNAL_RESET_SESSION_TOKEN,
    PasswordResetConfirmView,
)

from .utils import token_generator


class ResetPasswordPermission(BasePermission):
    def has_permission(self, request: Request, _) -> bool:
        try:
            _, token = request.path.split("/")[-2:]
        except ValueError:
            return False

        # logic came from this view
        if token == PasswordResetConfirmView.reset_url_token:
            return token_generator.check_token(
                user=request.user, token=request.session.get(INTERNAL_RESET_SESSION_TOKEN)
            )
        else:
            if token_generator.check_token(user=request.user, token=token):
                # Store the token in the session and redirect to the
                # password reset form at a URL without the token. That
                # avoids the possibility of leaking the token in the
                # HTTP Referer header.
                request.session[INTERNAL_RESET_SESSION_TOKEN] = token
                return True
        return False
