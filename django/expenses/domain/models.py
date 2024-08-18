from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from django.utils import timezone

from shared.utils import choices_to_enum

from ..choices import ExpenseCategory, ExpenseSource
from .exceptions import (
    ExpensesWithInstallmentsMustBeCreditedCardException,
    FixedExpensesWithInstallmentsNotAllowedException,
    FutureExpenseMustBeCreditCardException,
    OnlyUpdateFirstInstallmentDateException,
)

if TYPE_CHECKING:
    from ..models import Expense as ExpenseDataModel
    from .events import Event


@dataclass
class RevenueDTO:
    created_at: date
    value: Decimal
    description: str | None = None


@dataclass
class Expense:
    description: str
    created_at: date
    value: Decimal
    category: choices_to_enum(ExpenseCategory)
    source: choices_to_enum(ExpenseSource)
    installments_qty: int
    id: int | None = None
    is_fixed: bool = False
    installments_id: UUID | None = None
    installments: list[Expense] = field(default_factory=list)

    # self.installments = installments if installments is not None else []

    def __post_init__(
        self,
    ) -> None:
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
            if self.source != ExpenseSource.credit_card:
                raise ExpensesWithInstallmentsMustBeCreditedCardException()
        if (
            not self.is_fixed
            and self.created_at > timezone.localdate()
            and self.source != ExpenseSource.credit_card
        ):
            raise FutureExpenseMustBeCreditCardException()

    def validate_update(self, data_instance: ExpenseDataModel) -> None:
        if (
            data_instance.installment_number is not None
            and data_instance.installment_number != 1
            and data_instance.created_at != self.created_at
        ):
            raise OnlyUpdateFirstInstallmentDateException()

    def should_change_bank_account_amount(
        self, action: Literal["create", "update", "delete"]
    ) -> bool:
        today = timezone.localdate()
        default_condition = self.created_at <= today or self.source not in (
            ExpenseSource.credit_card,
            ExpenseSource.money,
        )
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
