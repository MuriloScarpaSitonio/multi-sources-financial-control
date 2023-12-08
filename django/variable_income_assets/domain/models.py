from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from django.utils import timezone

from ..choices import (
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from .events import AssetOperationClosed, Event
from .exceptions import (
    CurrencyConversionRateNullOrOneForNonBrlAssets,
    FutureTransactionNotAllowedException,
    NegativeQuantityNotAllowedException,
)

if TYPE_CHECKING:
    from ..models import Transaction


@dataclass
class TransactionDTO:
    action: TransactionActions
    quantity: Decimal
    price: Decimal
    operation_date: date
    current_currency_conversion_rate: Decimal | None = None
    external_id: str | None = None

    @property
    def is_sale(self) -> bool:
        return self.action == TransactionActions.sell


@dataclass
class PassiveIncomeDTO:  # TODO?
    type: PassiveIncomeTypes
    event_type: PassiveIncomeEventTypes
    quantity: Decimal
    amount: Decimal
    operation_date: date
    current_currency_conversion_rate: Decimal | None = None


class Asset:
    def __init__(
        self,
        id: int,
        quantity_balance: Decimal,
        currency: Currencies | None = None,
        avg_price: Decimal | None = None,
    ) -> None:
        self._id = id
        self.quantity_balance = quantity_balance
        self.currency = currency
        self.avg_price = avg_price

        self._transactions: list[TransactionDTO] = []
        self.events: list[Event] = []

    def add_transaction(self, transaction_dto: TransactionDTO) -> None:
        if transaction_dto.operation_date > timezone.localdate():
            raise FutureTransactionNotAllowedException

        if self.currency == Currencies.real:
            transaction_dto.current_currency_conversion_rate = 1
        else:
            if transaction_dto.current_currency_conversion_rate in (None, 1):
                raise CurrencyConversionRateNullOrOneForNonBrlAssets

        if transaction_dto.is_sale:
            if transaction_dto.quantity > self.quantity_balance:
                raise NegativeQuantityNotAllowedException

            if transaction_dto.quantity - self.quantity_balance == 0:
                self.events.append(AssetOperationClosed(asset_pk=self._id))

        self._transactions.append(transaction_dto)

    def update_transaction(self, dto: TransactionDTO, transaction: Transaction) -> TransactionDTO:
        if dto.operation_date > timezone.localdate():
            raise FutureTransactionNotAllowedException

        if self.currency == Currencies.real:
            dto.current_currency_conversion_rate = 1
        else:
            if dto.current_currency_conversion_rate in (None, 1):
                raise CurrencyConversionRateNullOrOneForNonBrlAssets

        if dto.is_sale:
            if transaction.quantity != dto.quantity and dto.quantity > self.quantity_balance:
                raise NegativeQuantityNotAllowedException

            if transaction.action != dto.action and (
                self.quantity_balance - (dto.quantity + transaction.quantity) < 0
            ):
                raise NegativeQuantityNotAllowedException

            if dto.quantity - self.quantity_balance == 0:
                self.events.append(AssetOperationClosed(asset_pk=self._id))

        self._transactions.append(dto)
        return dto

    def validate_delete_transaction_command(self, dto: TransactionDTO) -> None:
        if not dto.is_sale and (self.quantity_balance - dto.quantity) < 0:
            raise NegativeQuantityNotAllowedException
