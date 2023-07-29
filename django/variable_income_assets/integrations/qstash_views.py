from __future__ import annotations

from typing import TYPE_CHECKING

from django.http import HttpResponse

from rest_framework.status import HTTP_200_OK, HTTP_202_ACCEPTED, HTTP_400_BAD_REQUEST

from .authentication import verify_qstash_signature
from .binance.handlers import sync_binance_transactions
from .handlers import update_prices
from .kucoin.handlers import sync_kucoin_transactions

if TYPE_CHECKING:
    from django.core.handlers.asgi import ASGIRequest
    from django.core.handlers.wsgi import WSGIRequest


def _get_status(error: Exception | None) -> int:
    if error is None:
        return HTTP_200_OK
    return HTTP_202_ACCEPTED if getattr(error, "__retryable__", False) else HTTP_400_BAD_REQUEST


@verify_qstash_signature
async def update_prices_endpoint(_: ASGIRequest | WSGIRequest) -> HttpResponse:
    error = await update_prices()
    return HttpResponse("", status=_get_status(error))


@verify_qstash_signature
async def sync_binance_transactions_endpoint(request: ASGIRequest | WSGIRequest) -> HttpResponse:
    error = await sync_binance_transactions(
        task_history_id=request.POST.get("task_history_id"), user_id=request.POST.get("user_id")
    )
    return HttpResponse("", status=_get_status(error))


@verify_qstash_signature
async def sync_kucoin_transactions_endpoint(request: ASGIRequest | WSGIRequest) -> HttpResponse:
    error = await sync_kucoin_transactions(
        task_history_id=request.POST.get("task_history_id"), user_id=request.POST.get("user_id")
    )
    return HttpResponse("", status=_get_status(error))
