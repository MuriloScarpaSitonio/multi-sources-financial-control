from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth.tokens import default_token_generator, PasswordResetTokenGenerator

if TYPE_CHECKING:
    from .models import CustomUser

    default_token_generator: PasswordResetTokenGenerator


def dispatch_reset_password_email(user: CustomUser) -> None:
    token = default_token_generator.make_token(user=user)
    print(token, default_token_generator.check_token(user=user, token=token))
