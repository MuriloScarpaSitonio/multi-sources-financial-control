from functools import singledispatch
from uuid import uuid4

from ..domain import commands, events
from .unit_of_work import ExpenseUnitOfWork, RevenueUnitOfWork


def create_expense(cmd: commands.CreateExpense, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if cmd.expense.is_fixed:
            cmd.expense.recurring_id = uuid4()
            uow.expenses.add(cmd.expense)
            if cmd.perform_actions_on_future_fixed_entities:
                uow.expenses.add_future_fixed_expenses(cmd.expense)
        elif cmd.expense.installments_qty > 1:
            uow.expenses.add_installments(cmd.expense)
        else:
            uow.expenses.add(cmd.expense)

        cmd.expense.events.append(events.ExpenseCreated(expense=cmd.expense))
        uow.commit()


def update_expense(cmd: commands.UpdateExpense, uow: ExpenseUnitOfWork) -> None:
    with uow:
        if cmd.expense.recurring_id is not None and cmd.expense.is_fixed:
            uow.expenses.update(cmd.expense)
            if cmd.perform_actions_on_future_fixed_entities and not cmd.expense.is_past_month:
                uow.expenses.update_future_fixed_expenses(
                    cmd.expense,
                    created_at_changed=cmd.data_instance.created_at != cmd.expense.created_at,
                )
        elif cmd.expense.installments_id is not None:
            uow.expenses.update_installments(
                cmd.expense,
                created_at_changed=cmd.data_instance.created_at != cmd.expense.created_at,
            )
        else:
            if not cmd.data_instance.is_fixed and cmd.expense.is_fixed:
                # `is_fixed=False` updated to `is_fixed=True`
                cmd.expense.recurring_id = uuid4()
                uow.expenses.update(cmd.expense)
                if cmd.perform_actions_on_future_fixed_entities and not cmd.expense.is_past_month:
                    uow.expenses.add_future_fixed_expenses(cmd.expense)
            elif cmd.data_instance.is_fixed and not cmd.expense.is_fixed:
                # `is_fixed=True` updated to `is_fixed=False`
                cmd.expense.recurring_id = None
                uow.expenses.update(cmd.expense)
                if cmd.perform_actions_on_future_fixed_entities and not cmd.expense.is_past_month:
                    # as we have removed the `recurring_id` we need to set it back so we can find
                    # the related expenses
                    cmd.expense.recurring_id = cmd.data_instance.recurring_id
                    uow.expenses.delete_future_fixed_expenses(cmd.expense)

            else:
                uow.expenses.update(cmd.expense)

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
        if cmd.expense.recurring_id is not None:
            uow.expenses.delete(cmd.expense)
            if cmd.perform_actions_on_future_fixed_entities and not cmd.expense.is_past_month:
                uow.expenses.delete_future_fixed_expenses(cmd.expense)
        elif cmd.expense.installments_id is not None:
            uow.expenses.delete_installments(cmd.expense)
        else:
            uow.expenses.delete(cmd.expense)

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


def create_future_fixed_revenues(
    cmd: commands.CreateFutureFixedRevenues, uow: RevenueUnitOfWork
) -> None:
    with uow:
        uow.revenues.add_fixed_future_revenues(cmd.revenue)
        uow.commit()


def update_future_fixed_revenues(
    cmd: commands.UpdateFutureFixedRevenues, uow: RevenueUnitOfWork
) -> None:
    with uow:
        uow.revenues.update_future_fixed_revenues(
            cmd.revenue, created_at_changed=cmd.created_at_changed
        )
        uow.commit()


def delete_future_fixed_revenues(
    cmd: commands.DeleteFutureFixedRevenues, uow: RevenueUnitOfWork
) -> None:
    with uow:
        uow.revenues.delete_future_fixed_revenues(cmd.revenue)
        uow.commit()


def change_all_expenses_category_name(event: events.ExpenseCategoryUpdated, uow: ExpenseUnitOfWork):
    with uow:
        uow.expenses.change_all_category_name(prev_name=event.prev_name, name=event.name)
        uow.commit()


def change_all_expenses_source_name(event: events.ExpenseCategoryUpdated, uow: ExpenseUnitOfWork):
    with uow:
        uow.expenses.change_all_source_name(prev_name=event.prev_name, name=event.name)
        uow.commit()


def change_all_revenues_category_name(event: events.RevenueCategoryUpdated, uow: RevenueUnitOfWork):
    with uow:
        uow.revenues.change_all_category_name(prev_name=event.prev_name, name=event.name)
        uow.commit()
