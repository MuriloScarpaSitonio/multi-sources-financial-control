from __future__ import annotations

from typing import TYPE_CHECKING

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from asgiref.sync import async_to_sync  # TODO: remove when ASGI
from rest_framework.status import HTTP_200_OK, HTTP_202_ACCEPTED, HTTP_400_BAD_REQUEST

from .authentication import verify_qstash_signature
from .binance.handlers import sync_binance_transactions
from .handlers import update_prices
from .kucoin.handlers import sync_kucoin_transactions

if TYPE_CHECKING:
    # from django.core.handlers.asgi import ASGIRequest -> TODO: uncomment when ASGI
    from django.core.handlers.wsgi import WSGIRequest


def _get_status(exc: Exception | None) -> int:
    if exc is None:
        return HTTP_200_OK
    return HTTP_202_ACCEPTED if getattr(exc, "__retryable__", False) else HTTP_400_BAD_REQUEST


@verify_qstash_signature
@csrf_exempt
@require_POST
def update_prices_endpoint(_: WSGIRequest) -> HttpResponse:
    exc = async_to_sync(update_prices)()
    return HttpResponse("", status=_get_status(exc))


@verify_qstash_signature
@csrf_exempt
@require_POST
def sync_binance_transactions_endpoint(_: WSGIRequest, user_id: int, **__) -> HttpResponse:
    exc = async_to_sync(sync_binance_transactions)(user_id=user_id)
    return HttpResponse("", status=_get_status(exc))


@verify_qstash_signature
@csrf_exempt
@require_POST
def sync_kucoin_transactions_endpoint(_: WSGIRequest, user_id: int, **__) -> HttpResponse:
    exc = async_to_sync(sync_kucoin_transactions)(user_id=user_id)
    return HttpResponse("", status=_get_status(exc))
