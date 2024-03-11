from dataclasses import dataclass

from ..models import Expense as ExpenseDataModel
from .models import Expense as ExpenseDomainModel


class Command:
    ...


@dataclass
class ExpenseCommand(Command):
    expense: ExpenseDomainModel


class CreateExpense(ExpenseCommand):
    ...


@dataclass
class UpdateExpense(ExpenseCommand):
    data_instance: ExpenseDataModel


@dataclass
class DeleteExpense(ExpenseCommand):
    ...
