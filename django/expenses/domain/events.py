from dataclasses import dataclass
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


@dataclass
class RevenueUpdated(Event):
    diff: Decimal


@dataclass
class RevenueDeleted(Event):
    value: Decimal


class BankAccountNegative(Event): ...


@dataclass
class RelatedExpenseEntityUpdated(Event):
    prev_name: str
    name: str


class ExpenseCategoryUpdated(RelatedExpenseEntityUpdated): ...


class ExpenseSourceUpdated(RelatedExpenseEntityUpdated): ...


class RevenueCategoryUpdated(RelatedExpenseEntityUpdated): ...
