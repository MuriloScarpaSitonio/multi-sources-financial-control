from dataclasses import asdict, dataclass
from decimal import Decimal

from .models import Expense


class Event: ...


@dataclass
class ExpenseEvent(Event):
    expense: Expense


class ExpenseCreated(ExpenseEvent): ...


@dataclass
class ExpenseUpdated(ExpenseEvent):
    previous_value: Decimal


class ExpenseDeleted(ExpenseEvent): ...


@dataclass
class RevenueCreated(Event):
    value: Decimal
    bank_account_id: int | None = None


@dataclass
class RevenueUpdated(Event):
    diff: Decimal
    bank_account_id: int | None = None


@dataclass
class RevenueDeleted(Event):
    value: Decimal
    bank_account_id: int | None = None


class BankAccountNegative(Event): ...


@dataclass
class RelatedExpenseEntityUpdated(Event):
    prev_name: str
    name: str
    new_id: int

    def as_dict(self) -> dict:
        return asdict(self)


class ExpenseCategoryUpdated(RelatedExpenseEntityUpdated): ...


class ExpenseSourceUpdated(RelatedExpenseEntityUpdated): ...


class RevenueCategoryUpdated(RelatedExpenseEntityUpdated): ...
