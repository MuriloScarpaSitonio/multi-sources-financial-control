from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth.views import PasswordResetConfirmView
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

if TYPE_CHECKING:
    from django.contrib.auth.tokens import PasswordResetTokenGenerator

    from .models import CustomUser

token_generator: PasswordResetTokenGenerator = PasswordResetConfirmView.token_generator


def generate_reset_password_secrets(user: CustomUser) -> tuple[str, str]:
    return token_generator.make_token(user=user), urlsafe_base64_encode(force_bytes(user.pk))


def dispatch_reset_password_email(user: CustomUser) -> None:
    token, uidb64 = generate_reset_password_secrets(user=user)
    # TODO


def dispatch_not_found_email(email: str) -> None:
    # TODO
    ...
