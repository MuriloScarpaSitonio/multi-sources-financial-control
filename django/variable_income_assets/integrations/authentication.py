from __future__ import annotations

import json
from base64 import urlsafe_b64encode
from functools import wraps
from hashlib import sha256
from hmac import new as hmac_new
from time import time
from typing import TYPE_CHECKING

from django.conf import settings
from django.http import HttpResponse

from jwt import decode as decode_jwt
from rest_framework.status import HTTP_403_FORBIDDEN

if TYPE_CHECKING:
    from collections.abc import Callable

    # from django.core.handlers.asgi import ASGIRequest -> TODO: uncomment when ASGI
    from django.core.handlers.wsgi import WSGIRequest

    ViewType = Callable[[WSGIRequest], HttpResponse]

# region: exceptions


class InvalidQstashSignatureException(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(self.message)


# endregion: exceptions


def verify_qstash_signature(view: ViewType) -> ViewType:
    @wraps(view)
    def wrapper(request: WSGIRequest) -> HttpResponse:
        token = request.headers.get("upstash-signature")
        url = request.build_absolute_uri()
        body = json.loads(request.body or "{}")
        try:
            _verify_qstash_signature(
                token=token, signing_key=settings.QSTASH_CURRENT_SIGNING_KEY, body=body, url=url
            )
        except InvalidQstashSignatureException:
            try:
                _verify_qstash_signature(
                    token=token, signing_key=settings.QSTASH_NEXT_SIGNING_KEY, body=body, url=url
                )
            except InvalidQstashSignatureException as e:
                return HttpResponse(e.message, status=HTTP_403_FORBIDDEN)
        return view(request, **body)
        # return await view(request, **body) -> TODO: uncomment when ASGI

    return wrapper


# https://github.com/upstash/qstash-examples/blob/main/aws-lambda/python-example/lambda_function.py#L50
def _verify_qstash_signature(
    token: str | None, signing_key: str, body: dict | list | None, url: str
) -> None:  # pragma: no cover
    if not token:
        raise InvalidQstashSignatureException("Empty token")

    split = token.split(".")
    if len(split) != 3:
        raise InvalidQstashSignatureException("Invalid token")

    header, payload, signature = split

    message = header + "." + payload
    generated_signature = urlsafe_b64encode(
        hmac_new(bytes(signing_key, "utf-8"), bytes(message, "utf-8"), digestmod=sha256).digest()
    ).decode()

    if generated_signature != signature and signature + "=" != generated_signature:
        raise InvalidQstashSignatureException("Invalid token signature")

    decoded = decode_jwt(token, options={"verify_signature": False})
    decoded_body = decoded["body"]

    if decoded["iss"] != "Upstash":
        raise InvalidQstashSignatureException(f"Invalid issuer: {decoded['iss']}")

    if decoded["sub"] != url:
        raise InvalidQstashSignatureException(f"Invalid subject: {decoded['sub']}")

    now = time()
    if now > decoded["exp"]:
        raise InvalidQstashSignatureException("Token has expired")

    if now < decoded["nbf"]:
        raise InvalidQstashSignatureException("Token is not yet valid")

    if body is not None:
        while decoded_body[-1] == "=":
            decoded_body = decoded_body[:-1]

        m = sha256()
        m.update(bytes(body, "utf-8"))
        m = m.digest()
        generated_hash = urlsafe_b64encode(m).decode()

        if generated_hash != decoded_body and generated_hash != decoded_body + "=":
            raise InvalidQstashSignatureException("Body hash doesn't match")
