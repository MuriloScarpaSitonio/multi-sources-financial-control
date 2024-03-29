from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urljoin

from django.conf import settings
from django.core.mail import EmailMessage

from .token_generator import generate_token_secrets

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


def _send_email(to: list[str], template_id: int, **kwargs) -> None:
    message = EmailMessage(to=to)
    for attr, value in kwargs.items():
        setattr(message, attr, value)

    message.template_id = template_id
    message.from_email = None  # to use the template's default sender
    message.send()


def dispatch_reset_password_email(user: UserModel) -> None:
    token, uidb64 = generate_token_secrets(user=user)

    _send_email(
        to=[user.email],
        template_id=settings.BREVO_TEMPLATE_IDS["reset_password"],
        merge_global_data={
            "url": urljoin(settings.FRONTEND_BASE_URL, f"/reset_password/{uidb64}/{token}")
        },
    )


def dispatch_not_found_email(email: str) -> None:
    _send_email(to=[email], template_id=settings.BREVO_TEMPLATE_IDS["not_found"])


def dispatch_activation_email(user: UserModel) -> None:
    token, uidb64 = generate_token_secrets(user=user)

    _send_email(
        to=[user.email],
        template_id=settings.BREVO_TEMPLATE_IDS["activation"],
        merge_global_data={
            "url": urljoin(settings.FRONTEND_BASE_URL, f"/activate/{uidb64}/{token}")
        },
    )


def dispatch_trial_will_end_email(user: UserModel) -> None:
    _send_email(
        to=[user.email],
        template_id=settings.BREVO_TEMPLATE_IDS["triall_will_end"],
        merge_global_data={"url": urljoin(settings.FRONTEND_BASE_URL, "/me?tab=1")},
    )
