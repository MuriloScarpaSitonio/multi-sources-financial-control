from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from django.db.transaction import atomic
from django.utils import timezone

from aiohttp.client_exceptions import ClientError
from aiohttp.http_exceptions import HttpProcessingError
from aiohttp.web_exceptions import HTTPException
from asgiref.sync import async_to_sync, sync_to_async

from authentication.models import IntegrationSecret

from ..adapters.key_value_store import get_dollar_conversion_rate
from ..choices import AssetObjectives, AssetSectors, AssetTypes, Currencies
from ..domain.events import TransactionsCreated
from ..integrations.clients.abc import AbstractTransactionsClient
from ..models import Asset
from ..service_layer.unit_of_work import DjangoUnitOfWork
from ..tasks import maybe_create_asset_metadata
from .clients import BrApiClient, TwelveDataClient

if TYPE_CHECKING:
    from .schemas import TransactionFromIntegration, TransactionPydanticModel


async def get_b3_prices(codes: list[str]) -> dict[str, float]:
    async with BrApiClient() as c:
        return await c.get_b3_prices(codes=codes)


async def get_crypto_prices(codes: list[str], currency: Currencies):
    async with BrApiClient() as c:
        return await c.get_crypto_prices(codes=codes, currency=currency)


async def get_stocks_usa_prices(codes: list[str]):
    async with TwelveDataClient() as c:
        return await c.get_prices(codes=codes)


# TODO: fetch API
def fetch_asset_sector(code: str, asset_type: AssetTypes) -> AssetSectors:
    sector = AssetSectors.unknown
    if asset_type == AssetTypes.crypto:
        sector = AssetSectors.tech
    elif asset_type == AssetTypes.fii:
        sector = AssetSectors.essential_consumption
    return sector


def fetch_asset_current_price(code: str, asset_type: AssetTypes, currency: Currencies) -> Decimal:
    kwargs = {"codes": (code,)}
    if asset_type in (AssetTypes.stock, AssetTypes.fii):
        coro = get_b3_prices
    elif asset_type == AssetTypes.stock_usa:
        coro = get_stocks_usa_prices
    elif asset_type == AssetTypes.crypto:
        coro = get_crypto_prices
        kwargs["currency"] = currency

    try:
        result = async_to_sync(coro)(**kwargs)
        return Decimal(result[code])
    except Exception:
        # TODO: log error
        return Decimal()


# TODO: fetch API
def fetch_currency_conversion_rate(operation_date: date, currency: Currencies) -> Decimal:
    return Decimal("1") if currency == Currencies.real else get_dollar_conversion_rate()


def fetch_dollar_to_real_conversion_value() -> Decimal:
    async def _fetch_dollar_to_real_conversion_value() -> str:
        async with BrApiClient() as client:
            return await client.convert_currencies(from_=Currencies.dollar, to=Currencies.real)

    return Decimal(async_to_sync(_fetch_dollar_to_real_conversion_value)())


class TransactionsIntegrationOrchestrator:
    def __init__(
        self,
        client_class: type[AbstractTransactionsClient],
        integration_model_class: type[TransactionFromIntegration],
        user_id: int,
    ) -> None:
        self._client_class = client_class
        self._integration_model_class = integration_model_class
        self.user_id = user_id

    async def sync(self) -> tuple[str, Exception | None]:
        notification_display_text, exc = "", None
        try:
            async with self._client_class(
                secrets=await IntegrationSecret.objects.aget(user=self.user_id)
            ) as client:
                data = await client.fetch_transactions()

            count = await self._sync(raw_data=data)
            notification_display_text = f"{count} transações encontradas"

        except Exception as e:
            exc = e
            if isinstance(exc, ClientError | HTTPException | HttpProcessingError):
                exc.__retryable__ = True

        return notification_display_text, exc

    def _convert_and_validate_data(
        self, data: dict[str, Any]
    ) -> Iterator[TransactionPydanticModel]:
        for d in data:
            yield self._integration_model_class(**d).as_transaction(by_alias=True)

    async def _sync(self, raw_data: list[dict[str, Any]]) -> int:
        assets: set[Asset] = set()
        count = 0
        for transaction in self._convert_and_validate_data(raw_data):
            # TODO: order data so we create `BUY` transactions first
            try:
                if await transaction.is_skippable():
                    continue

                asset = await sync_to_async(self._create_entities)(transaction)
                # it's ok to not overwrite the asset object because it'll
                # be queried again in the emitted event below. In fact, this is necessary so we
                # don't overwrite `__created__` (check `_create_entities` method)
                assets.add(asset)
                count += 1
            except Exception as e:
                # TODO: log error
                print(e)
                continue

        await sync_to_async(self._update_read_models)(assets)
        return count

    @atomic
    def _create_entities(self, transaction: TransactionPydanticModel) -> Asset:
        asset, created = Asset.objects.annotate_for_domain().get_or_create(
            user_id=self.user_id,
            code=transaction.code,
            type=AssetTypes.crypto,
            currency=transaction.currency.value,
            defaults={"objective": AssetObjectives.growth},
        )
        if created:
            maybe_create_asset_metadata(
                asset,
                sector=AssetSectors.tech,
                current_price=transaction.price,
                current_price_updated_at=timezone.now(),
            )
        transaction.create(asset=asset)

        asset.__created__ = created
        return asset

    def _update_read_models(self, assets: set[Asset]) -> None:
        from ..service_layer import messagebus  # avoid cirtular import error

        for asset in assets:
            # TODO: rollback transactions related to this asset if fails?!
            with DjangoUnitOfWork(asset_pk=asset.pk) as uow:
                messagebus.handle(
                    message=TransactionsCreated(asset_pk=asset.pk, new_asset=asset.__created__),
                    uow=uow,
                )
