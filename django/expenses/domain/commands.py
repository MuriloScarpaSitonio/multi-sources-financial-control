from dataclasses import dataclass

from ..models import Expense as ExpenseDataModel
from .models import Expense as ExpenseDomainModel


class Command: ...


@dataclass
class ExpenseCommand(Command):
    expense: ExpenseDomainModel
    perform_actions_on_future_fixed_expenses: bool


class CreateExpense(ExpenseCommand): ...


@dataclass
class UpdateExpense(ExpenseCommand):
    data_instance: ExpenseDataModel


@dataclass
class DeleteExpense(ExpenseCommand): ...
