from datetime import date
from decimal import Decimal

from django.conf import settings

from pydantic import BaseModel, Field, condecimal

from shared.utils import choices_to_enum

from ..choices import Currencies, TransactionActions
from ..domain.commands import CreateTransactions
from ..domain.models import TransactionDTO
from ..models import Asset, Transaction
from ..service_layer import messagebus
from ..service_layer.unit_of_work import DjangoUnitOfWork


class TransactionPydanticModel(BaseModel):
    id: str | int
    price: Decimal = condecimal(decimal_places=8, max_digits=15)
    quantity: Decimal = condecimal(decimal_places=8, max_digits=15)
    operation_date: date
    action: choices_to_enum(TransactionActions)
    code: str = Field(exclude=True)
    currency: choices_to_enum(Currencies) = Field(exclude=True)

    async def is_skippable(self) -> bool:
        return (
            self.code in settings.USD_CRYPTO_SYMBOLS
            or await Transaction.objects.filter(external_id=self.id).aexists()
        )

    def create(self, asset: Asset) -> None:
        from .helpers import fetch_currency_conversion_rate

        asset_domain = asset.to_domain()
        asset_domain.add_transaction(
            transaction_dto=TransactionDTO(
                action=self.action.value,
                operation_date=self.operation_date,
                quantity=self.quantity,
                price=self.price,
                external_id=self.id,
                current_currency_conversion_rate=fetch_currency_conversion_rate(
                    operation_date=self.operation_date, currency=asset.currency
                ),
            )
        )
        messagebus.handle(
            message=CreateTransactions(asset=asset_domain, dispatch_event=False),
            uow=DjangoUnitOfWork(asset_pk=asset.pk),
        )


class TransactionFromIntegration(BaseModel):
    def as_transaction(self, **kwargs) -> TransactionPydanticModel:
        return TransactionPydanticModel.model_validate(self.model_dump(**kwargs))
