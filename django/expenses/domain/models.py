from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from django.utils import timezone

from ..choices import CATEGORIES_NOT_ALLOWED_IN_FUTURE, CREDIT_CARD_SOURCE
from .exceptions import (
    ExpensesWithInstallmentsMustBeCreditedCardException,
    FixedExpensesWithInstallmentsNotAllowedException,
    FutureExpenseMustBeCreditCardException,
    OnlyUpdateFirstInstallmentDateException,
    OnlyUpdateFixedExpenseDateWithinMonthException,
)

if TYPE_CHECKING:
    from ..models import Expense as ExpenseDataModel
    from .events import Event


@dataclass
class IsPastOrFutureMixin:
    created_at: date

    def __post_init__(self) -> None:
        self._today = timezone.localdate()

    @property
    def is_past_month(self) -> bool:
        return (
            self.created_at.month < self._today.month and self.created_at.year <= self._today.year
        )

    @property
    def is_past(self):
        return self.created_at <= self._today

    @property
    def is_current_month(self):
        return (
            self.created_at.month == self._today.month and self.created_at.year == self._today.year
        )


@dataclass
class Revenue(IsPastOrFutureMixin):
    value: Decimal
    id: int | None = None
    description: str | None = None
    is_fixed: bool = False
    recurring_id: UUID | None = None


@dataclass
class Expense(IsPastOrFutureMixin):
    description: str
    value: Decimal
    category: str
    source: str
    installments_qty: int
    id: int | None = None
    is_fixed: bool = False
    recurring_id: UUID | None = None
    installments_id: UUID | None = None
    installments: list[Expense] = field(default_factory=list)
    # not really something related to the domain model
    # but rather fields that need to be persisted in the DB
    extra_data: dict = field(default_factory=dict)
    #

    def __post_init__(self) -> None:
        super().__post_init__()

        self.validate()
        self.events: list[Event] = []

    def __repr__(self) -> str:
        return f"<Expense ({self.id})>"

    def __hash__(self) -> int:
        return hash(self.id)

    def validate(self):
        if self.installments_qty > 1:
            if self.is_fixed:
                raise FixedExpensesWithInstallmentsNotAllowedException()
            if self.source != CREDIT_CARD_SOURCE:
                raise ExpensesWithInstallmentsMustBeCreditedCardException()
        # if (
        #     not self.is_fixed
        #     and self.created_at > timezone.localdate()
        #     and self.source != CREDIT_CARD_SOURCE
        # ):
        #     raise FutureExpenseMustBeCreditCardException()

    def validate_update(self, data_instance: ExpenseDataModel) -> None:
        if (
            data_instance.installment_number is not None
            and data_instance.installment_number != 1
            and data_instance.created_at != self.created_at
        ):
            raise OnlyUpdateFirstInstallmentDateException()

        if self.is_fixed and (
            self.created_at.month != data_instance.created_at.month
            or self.created_at.year != data_instance.created_at.year
        ):
            raise OnlyUpdateFixedExpenseDateWithinMonthException()

    def should_change_bank_account_amount(
        self, action: Literal["create", "update", "delete"]
    ) -> bool:
        today = timezone.localdate()
        default_condition = (
            self.is_past and not self.is_past_month
        ) or self.source not in CATEGORIES_NOT_ALLOWED_IN_FUTURE
        if action in ("create", "update"):
            return default_condition
        if action == "delete":
            return (
                default_condition
                if self.installments_id is None
                else any(e.created_at <= today for e in self.installments)
            )

    def get_updated_value_change(self, previous_value: Decimal) -> Decimal:
        today = timezone.localdate()
        value = diff = (self.value if self.created_at <= today else Decimal()) - previous_value
        for expense in self.installments:
            if expense.created_at <= today:
                value += diff
        return value

    def get_decrement_value(self) -> Decimal:
        return self.value / self.installments_qty if self.id is None else self.value

    def get_increment_value(self) -> Decimal:
        if self.installments_id is None:
            return self.value
        today = timezone.localdate()
        value = self.value if self.created_at <= today else Decimal()
        for expense in self.installments:
            if expense.created_at <= today:
                value += expense.value
        return value


# class BankAccount:
#     def __init__(self, amount: Decimal) -> None:
#         self.amount = amount
#         self.events: list[Event] = []

#     def decrement(self, dto: Expense) -> None:
#         if dto.created_at <= timezone.localdate() or dto.source != ExpenseSource.credit_card:
#             self.amount -= dto.value
#             self.events.append(BankAccountDecremented(entity_id=dto.id))
#             if self.amount < 0:
#                 self.events.append(BankAccountNegative(entity_id=dto.id))

#     def increment(self, dto: RevenueDTO) -> None:
#         if dto.created_at <= timezone.localdate():
#             self.amount += dto.value
#             self.events.append(BankAccountIncremented(entity_id=dto.id))
