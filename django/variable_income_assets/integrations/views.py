import asyncio

from django.core.handlers.wsgi import WSGIRequest
from django.core.handlers.asgi import ASGIRequest
from django.http import HttpResponse
from django.utils import timezone

from asgiref.sync import sync_to_async
from rest_framework_simplejwt.authentication import JWTAuthentication
from tasks.decorators import start_task

from .clients import BrApiClient, TwelveDataClient
from ..choices import AssetTypes, TransactionCurrencies
from ..domain.events import AssetUpdated
from ..models import Asset
from ..models.managers import AssetQuerySet
from ..service_layer import messagebus
from ..service_layer.unit_of_work import DjangoUnitOfWork


async def _get_b3_prices(codes: list[str]) -> dict[str, float]:
    async with BrApiClient() as c:
        return await c.get_b3_prices(codes=codes)


async def _get_crypto_prices(codes: list[str], currency: TransactionCurrencies.values):
    async with BrApiClient() as c:
        return await c.get_crypto_prices(codes=codes, currency=currency)


async def _get_usa_stocks_prices(codes: list[str]):
    async with TwelveDataClient() as c:
        return await c.get_prices(codes=codes)


async def _fetch_prices(qs: AssetQuerySet[Asset]) -> tuple[dict[str, Asset], dict[str, float]]:
    b3_codes: list[str] = []
    crypto_brl_codes: list[str] = []
    crypto_usd_codes: list[str] = []
    usa_stocks_codes: list[str] = []
    assets_map: dict[str, Asset] = {}
    async for asset in qs:
        assets_map[asset.code] = asset
        if asset.type == AssetTypes.stock:
            b3_codes.append(asset.code)
        elif asset.type == AssetTypes.stock_usa:
            usa_stocks_codes.append(asset.code)
        elif asset.type == AssetTypes.crypto:
            if asset.currency == TransactionCurrencies.real:
                crypto_brl_codes.append(asset.code)
            else:
                crypto_usd_codes.append(asset.code)
    tasks = [
        _get_b3_prices(codes=b3_codes),
        _get_crypto_prices(codes=crypto_usd_codes, currency=TransactionCurrencies.dollar),
        _get_crypto_prices(codes=crypto_brl_codes, currency=TransactionCurrencies.real),
        _get_usa_stocks_prices(codes=usa_stocks_codes),
    ]

    return assets_map, {
        code: price
        for result in await asyncio.gather(*tasks, return_exceptions=True)
        if not isinstance(result, Exception)
        for code, price in result.items()
    }


def _dispatch_asset_updated_event(pk: int) -> None:
    with DjangoUnitOfWork(asset_pk=pk) as uow:
        messagebus.handle(message=AssetUpdated(asset_pk=pk), uow=uow)


async def update_prices(request: ASGIRequest | WSGIRequest) -> HttpResponse:
    user, _ = await sync_to_async(JWTAuthentication().authenticate)(request)

    task = await sync_to_async(start_task)(
        task_name="fetch_current_assets_prices", user=user, return_obj=True
    )
    qs = (
        Asset.objects.filter(user_id=user.id)
        .annotate_currency()
        .only("pk", "code", "type")
        .distinct()
    )
    error = None
    try:
        assets_map, result = await _fetch_prices(qs=qs)
        for code, price in result.items():
            asset = assets_map[code]
            asset.current_price = str(price)
            asset.current_price_updated_at = timezone.now()

        await Asset.objects.abulk_update(
            objs=assets_map.values(), fields=("current_price", "current_price_updated_at")
        )

        async for asset in qs:
            await sync_to_async(_dispatch_asset_updated_event)(asset.pk)

    except Exception as e:
        error = repr(e)

    await sync_to_async(task.finish)(error=error)
    return HttpResponse("", status=200 if error is None else 400)
