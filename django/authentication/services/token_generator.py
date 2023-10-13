from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes
from django.utils.http import base36_to_int, urlsafe_base64_encode

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    UserModel = get_user_model()


class TokenGenerator(PasswordResetTokenGenerator):
    def check_token(self, user: UserModel, token: str, expire: bool = True) -> bool:
        """Equal to parent's implementation, but not always check for expiration time"""
        if not (user and token):  # pragma: no cover
            return False

        try:
            ts_b36, _ = token.split("-")
        except ValueError:
            return False

        try:
            ts = base36_to_int(ts_b36)
        except ValueError:  # pragma: no cover
            return False

        # Check that the timestamp/uid has not been tampered with
        for secret in [self.secret, *self.secret_fallbacks]:
            if constant_time_compare(
                self._make_token_with_timestamp(user, ts, secret),
                token,
            ):
                break
        else:  # pragma: no cover
            return False

        # Check the timestamp is within limit.
        if expire and (self._num_seconds(self._now()) - ts) > settings.PASSWORD_RESET_TIMEOUT:
            return False

        return True


token_generator = TokenGenerator()


def generate_token_secrets(user: UserModel) -> tuple[str, str]:
    return token_generator.make_token(user=user), urlsafe_base64_encode(force_bytes(user.pk))
