from dataclasses import dataclass

from ..models import Expense as ExpenseDataModel
from .models import Expense as ExpenseDomainModel
from .models import Revenue as RevenueDomainModel


class Command: ...


@dataclass
class ExpenseCommand(Command):
    expense: ExpenseDomainModel
    perform_actions_on_future_fixed_entities: bool


class CreateExpense(ExpenseCommand): ...


@dataclass
class UpdateExpense(ExpenseCommand):
    data_instance: ExpenseDataModel


@dataclass
class DeleteExpense(ExpenseCommand): ...


@dataclass
class RevenueCommand(Command):
    revenue: RevenueDomainModel


@dataclass
class CreateFutureFixedRevenues(RevenueCommand): ...


@dataclass
class UpdateFutureFixedRevenues(RevenueCommand):
    created_at_changed: bool


@dataclass
class DeleteFutureFixedRevenues(RevenueCommand): ...
