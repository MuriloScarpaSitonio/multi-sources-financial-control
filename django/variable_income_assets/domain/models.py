from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from .events import Event
from .exceptions import MultipleCurrenciesNotAllowedException, NegativeQuantityNotAllowedException
from ..choices import TransactionActions, TransactionCurrencies


if TYPE_CHECKING:  # pragma: no cover
    from ..models import Transaction


@dataclass
class TransactionDTO:
    action: TransactionActions
    currency: TransactionCurrencies
    quantity: Decimal
    price: Decimal
    created_at: datetime | None = None
    initial_price: Decimal | None = None
    external_id: str | None = None
    fetched_by_id: int | None = None

    @property
    def is_sale(self) -> bool:
        return self.action == TransactionActions.sell


class Asset:
    def __init__(
        self,
        quantity: Decimal,
        avg_price: Decimal,
        currency: TransactionCurrencies | None = None,
    ) -> None:
        self.quantity = quantity
        self.avg_price = avg_price
        self.currency = currency

        self._transactions: list[TransactionDTO] = []
        self.events: list[Event] = []

    def _validate_transaction_currency(self, transaction_dto: TransactionDTO) -> None:
        if self.currency is not None and self.currency != transaction_dto.currency:
            raise MultipleCurrenciesNotAllowedException(asset_currency=self.currency)

    def _validate_transaction_quantity_on_creation(self, transaction_dto: TransactionDTO) -> None:
        if transaction_dto.is_sale and transaction_dto.quantity > self.quantity:
            raise NegativeQuantityNotAllowedException()

    def _validate_transaction_quantity_on_update(
        self, transaction: Transaction, dto: TransactionDTO
    ) -> None:
        if dto.is_sale and transaction.quantity != dto.quantity and dto.quantity > self.quantity:
            raise NegativeQuantityNotAllowedException()

        if (
            dto.is_sale
            and transaction.action != dto.action
            and (self.quantity - (dto.quantity + transaction.quantity) < 0)
        ):
            raise NegativeQuantityNotAllowedException()

    def add_transaction(self, transaction_dto: TransactionDTO) -> TransactionDTO:
        self._validate_transaction_currency(transaction_dto=transaction_dto)
        self._validate_transaction_quantity_on_creation(transaction_dto=transaction_dto)

        if transaction_dto.is_sale and transaction_dto.initial_price is None:
            transaction_dto.initial_price = self.avg_price

        self._transactions.append(transaction_dto)

    def update_transaction(self, dto: TransactionDTO, transaction: Transaction) -> Transaction:
        self._validate_transaction_currency(transaction_dto=dto)
        self._validate_transaction_quantity_on_update(transaction=transaction, dto=dto)

        if dto.is_sale and dto.initial_price is None:
            dto.initial_price = self.avg_price

        self._transactions.append(dto)
        return dto

    def validate_delete_transaction_command(self, dto: TransactionDTO) -> None:
        if not dto.is_sale and (self.quantity - dto.quantity) < 0:
            raise NegativeQuantityNotAllowedException()
