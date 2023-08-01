from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urljoin

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .token_generator import token_generator

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


def generate_token_secrets(user: UserModel) -> tuple[str, str]:
    return token_generator.make_token(user=user), urlsafe_base64_encode(force_bytes(user.pk))


def dispatch_reset_password_email(user: UserModel) -> None:
    # TODO
    token, uidb64 = generate_token_secrets(user=user)
    print(token, uidb64)


def dispatch_not_found_email(email: str) -> None:
    # TODO
    print("not found!")


def dispatch_activation_email(user: UserModel) -> None:
    # TODO
    token, uidb64 = generate_token_secrets(user=user)

    message = EmailMessage(to=[user.email])
    message.template_id = settings.BREVO_TEMPLATE_IDS["activation"]
    message.from_email = None  # to use the template's default sender
    message.merge_global_data = {
        "url": urljoin(settings.FRONTEND_BASE_URL, f"/activate/{uidb64}/{token}")
    }
    message.send()
