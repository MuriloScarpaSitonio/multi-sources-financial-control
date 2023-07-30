from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .token_generator import token_generator

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


def generate_token_secrets(user: UserModel) -> tuple[str, str]:
    return token_generator.make_token(user=user), urlsafe_base64_encode(force_bytes(user.pk))


def dispatch_reset_password_email(user: UserModel) -> None:
    token, uidb64 = generate_token_secrets(user=user)
    # TODO


def dispatch_not_found_email(email: str) -> None:
    # TODO
    ...


def dispatch_activation_email(user: UserModel) -> None:
    # TODO
    token, uidb64 = generate_token_secrets(user=user)
