from functools import singledispatch

from ..domain import commands, events
from .unit_of_work import ExpenseUnitOfWork, RevenueUnitOfWork


def create_expense(cmd: commands.CreateExpense, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if cmd.expense.installments_qty > 1:
            uow.expenses.add_installments(dto=cmd.expense)
        else:
            uow.expenses.add(dto=cmd.expense)

        cmd.expense.events.append(events.ExpenseCreated(expense=cmd.expense))
        uow.commit()


def update_expense(cmd: commands.UpdateExpense, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if cmd.expense.installments_id:
            uow.expenses.update_installments(
                dto=cmd.expense,
                created_at_changed=cmd.data_instance.created_at != cmd.expense.created_at,
            )
        else:
            uow.expenses.update(dto=cmd.expense)

        # make sure to update the installments, if applicable
        cmd.expense.installments = uow.expenses.get_installments(
            id=cmd.expense.id, installments_id=cmd.expense.installments_id
        )
        cmd.expense.events.append(
            events.ExpenseUpdated(expense=cmd.expense, previous_value=cmd.data_instance.value)
        )
        uow.commit()


def delete_expense(cmd: commands.DeleteExpense, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if cmd.expense.installments_id is None:
            uow.expenses.delete(dto=cmd.expense)
        else:
            uow.expenses.delete_installments(dto=cmd.expense)
        cmd.expense.events.append(events.ExpenseDeleted(expense=cmd.expense))
        uow.commit()


def maybe_decrement_bank_account(event: events.ExpenseCreated, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if event.expense.should_change_bank_account_amount(action="create"):
            uow.bank_account.decrement(value=event.expense.get_decrement_value())
            uow.commit()


def maybe_increment_bank_account(event: events.ExpenseDeleted, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if event.expense.should_change_bank_account_amount(action="delete"):
            uow.bank_account.increment(value=event.expense.get_increment_value())
            uow.commit()


def maybe_change_bank_account(event: events.ExpenseUpdated, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if event.expense.should_change_bank_account_amount(action="update"):
            uow.bank_account.decrement(
                value=event.expense.get_updated_value_change(previous_value=event.previous_value)
            )
            uow.commit()


def increment_bank_account(event: events.RevenueCreated, uow: RevenueUnitOfWork) -> None:
    with uow:
        uow.bank_account.increment(value=event.value)
        uow.commit()


@singledispatch
def decrement_bank_account(event: events.RevenueDeleted, uow: RevenueUnitOfWork) -> None:
    with uow:
        uow.bank_account.decrement(value=event.value)
        uow.commit()


@decrement_bank_account.register
def _(event: events.RevenueUpdated, uow: RevenueUnitOfWork) -> None:
    with uow:
        uow.bank_account.decrement(value=event.diff)
        uow.commit()
