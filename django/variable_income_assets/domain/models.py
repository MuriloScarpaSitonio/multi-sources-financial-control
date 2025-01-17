from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from django.template.defaultfilters import slugify
from django.utils import timezone

from shared.utils import choices_to_enum

from ..choices import (
    AssetObjectives,
    AssetTypes,
    Currencies,
    PassiveIncomeEventTypes,
    PassiveIncomeTypes,
    TransactionActions,
)
from .exceptions import (
    AssetHeldInSelfCustodyButNotFixedException,
    AssetNotHeldInSelfCustodyWithoutQuantityException,
    CurrencyConversionRateNullOrOneForNonBrlAssets,
    FutureTransactionNotAllowedException,
    InvalidAssetCurrentException,
    NegativeQuantityNotAllowedException,
    SpaceNotAllowedInB3AssetCode,
)

if TYPE_CHECKING:
    from ..models import Transaction
    from .events import Event


@dataclass
class TransactionDTO:
    action: choices_to_enum(TransactionActions)
    price: Decimal
    operation_date: date
    quantity: Decimal | None = None
    current_currency_conversion_rate: Decimal | None = None
    external_id: str = ""

    @property
    def is_sale(self) -> bool:
        return self.action == TransactionActions.sell


@dataclass
class PassiveIncomeDTO:  # TODO?
    type: choices_to_enum(PassiveIncomeTypes)
    event_type: choices_to_enum(PassiveIncomeEventTypes)
    quantity: Decimal
    amount: Decimal
    operation_date: date
    current_currency_conversion_rate: Decimal | None = None


@dataclass(unsafe_hash=True)
class Asset:
    type: choices_to_enum(AssetTypes)
    code: str = ""
    id: int | None = None
    description: str = ""
    objective: choices_to_enum(AssetObjectives) = AssetObjectives.unknown
    description: str = ""
    quantity_balance: Decimal | None = None
    currency: Currencies | None = None
    avg_price: Decimal | None = None

    # é um ativo custodiado pelo banco emissor?
    # (ou seja, aplica-se apenas para renda fixa e  nao pode ser sincronizado pela b3)
    is_held_in_self_custody: bool = False

    def __post_init__(self) -> None:
        self._transactions: list[TransactionDTO] = []
        self.events: list[Event] = []

        if self.is_held_in_self_custody:
            self.code = self.description
            self.code = slugify(self.description)
        else:
            self.code = self.code.upper()

    def validate(self) -> None:
        if self.currency not in AssetTypes.get_choice(self.type).valid_currencies:
            raise InvalidAssetCurrentException(
                message_interpolation_params={"currency": self.currency, "type": self.type}
            )

        if self.is_held_in_self_custody:
            if self.type != AssetTypes.fixed_br:
                raise AssetHeldInSelfCustodyButNotFixedException
        else:
            if " " in self.code:
                raise SpaceNotAllowedInB3AssetCode

    @property
    def is_fixed_br(self) -> bool:
        return self.type == AssetTypes.fixed_br

    def add_transaction(self, transaction_dto: TransactionDTO) -> None:
        from .events import AssetOperationClosed

        if transaction_dto.quantity is None and not self.is_held_in_self_custody:
            raise AssetNotHeldInSelfCustodyWithoutQuantityException

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
                self.events.append(AssetOperationClosed(asset_pk=self.id))

        self._transactions.append(transaction_dto)

    def update_transaction(self, dto: TransactionDTO, transaction: Transaction) -> TransactionDTO:
        from .events import AssetOperationClosed

        if dto.quantity is None and not self.is_held_in_self_custody:
            raise AssetNotHeldInSelfCustodyWithoutQuantityException

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
                self.events.append(AssetOperationClosed(asset_pk=self.id))

        self._transactions.append(dto)
        return dto

    def validate_delete_transaction_command(self, dto: TransactionDTO) -> None:
        if not dto.is_sale and (self.quantity_balance - dto.quantity) < 0:
            raise NegativeQuantityNotAllowedException
