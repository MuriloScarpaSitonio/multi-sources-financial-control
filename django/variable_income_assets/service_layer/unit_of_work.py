from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import TYPE_CHECKING, Self

from django.db import transaction as djtransaction

from ..adapters import AssetRepository, PassiveIncomeRepository, TransactionRepository

if TYPE_CHECKING:  # pragma: no cover
    from ..domain.events import Event


class AbstractUnitOfWork(ABC):
    assets: AssetRepository

    def __init__(self, asset_pk: int) -> None:
        self.asset_pk = asset_pk

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args) -> None:
        self.rollback()

    def collect_new_events(self) -> Iterator[Event]:
        for asset in self.assets.seen:
            while asset.events:
                yield asset.events.pop(0)

    @abstractmethod
    def commit(self) -> None:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def rollback(self) -> None:  # pragma: no cover
        raise NotImplementedError


class DjangoUnitOfWork(AbstractUnitOfWork):
    def __init__(self, asset_pk: int) -> None:
        super().__init__(asset_pk)

        # From the docs:
        # https://docs.djangoproject.com/en/4.1/topics/db/transactions/#django.db.transaction.set_autocommit
        # You must ensure that no transaction is active, usually by issuing a
        # `commit()` or a `rollback()`, before turning autocommit back on.
        # Django will refuse to turn autocommit off when an `atomic()` block is active,
        # because that would break atomicity.
        self._inside_atomic_block = djtransaction.get_autocommit() is False

    def __enter__(self) -> Self:
        self.assets = AssetRepository(
            transactions_repository=TransactionRepository(asset_pk=self.asset_pk),
            incomes_repository=PassiveIncomeRepository(asset_pk=self.asset_pk),
        )
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
