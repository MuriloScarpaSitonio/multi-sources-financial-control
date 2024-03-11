from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import TYPE_CHECKING, Self

from django.db import transaction as djtransaction

from ..adapters import DjangoBankAccountRepository, ExpenseRepository

if TYPE_CHECKING:
    from ..domain.events import Event


class AbstractUnitOfWork(ABC):
    def __init__(self, user_id: int) -> None:
        self.user_id = user_id

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args) -> None:
        self.rollback()

    @abstractmethod
    def commit(self) -> None:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def rollback(self) -> None:  # pragma: no cover
        raise NotImplementedError


class DjangoUnitOfWork(AbstractUnitOfWork):
    def __init__(self, user_id: int) -> None:
        super().__init__(user_id=user_id)

        # From the docs:
        # https://docs.djangoproject.com/en/4.1/topics/db/transactions/#django.db.transaction.set_autocommit
        # You must ensure that no transaction is active, usually by issuing a
        # `commit()` or a `rollback()`, before turning autocommit back on.
        # Django will refuse to turn autocommit off when an `atomic()` block is active,
        # because that would break atomicity.
        self._inside_atomic_block = djtransaction.get_autocommit() is False

    def __enter__(self) -> Self:
        self.bank_account = DjangoBankAccountRepository(user_id=self.user_id)
        if not self._inside_atomic_block:
            djtransaction.set_autocommit(False)
        return super().__enter__()

    def __exit__(self, *args):
        super().__exit__(*args)
        if not self._inside_atomic_block:
            djtransaction.set_autocommit(True)

    def commit(self) -> None:
        if not self._inside_atomic_block:
            djtransaction.commit()

    def rollback(self) -> None:
        if not self._inside_atomic_block:
            djtransaction.rollback()


class ExpenseUnitOfWork(DjangoUnitOfWork):
    expenses: ExpenseRepository

    def __enter__(self) -> Self:
        self.expenses = ExpenseRepository(user_id=self.user_id)
        return super().__enter__()

    def collect_new_events(self) -> Iterator[Event]:
        for expense in self.expenses.seen:
            while expense.events:
                yield expense.events.pop(0)


class RevenueUnitOfWork(DjangoUnitOfWork):
    def collect_new_events(self) -> Iterator:
        for _ in ():
            yield
