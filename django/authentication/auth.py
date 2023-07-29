from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils.http import urlsafe_base64_decode

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

if TYPE_CHECKING:
    from rest_framework.request import Request

UserModel = get_user_model()


class ResetPasswordAuthentication(BaseAuthentication):
    def authenticate(self, request: Request) -> tuple[UserModel, None] | None:
        """Check django.contrib.auth.views.PasswordResetConfirmView.get_user"""
        try:
            uidb64, _ = request.path.split("/")[-2:]
        except ValueError:
            # If authentication is not attempted, return None.
            # Any other authentication schemes also in use will still be checked.
            return None

        try:
            # urlsafe_base64_decode() decodes to bytestring
            uid = urlsafe_base64_decode(uidb64).decode()
            user = UserModel._default_manager.get(pk=uid)
        except (TypeError, ValueError, OverflowError, UserModel.DoesNotExist, ValidationError) as e:
            raise AuthenticationFailed("No such user") from e

        return user, None
