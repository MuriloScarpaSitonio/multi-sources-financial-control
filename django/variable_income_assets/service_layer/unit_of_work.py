from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterator, TYPE_CHECKING

from django.db import transaction as djtransaction

from ..adapters.repository import AssetRepository, TransactionRepository

if TYPE_CHECKING:
    from ..domain.events import Event


class AbstractUnitOfWork(ABC):
    assets: AssetRepository

    def __init__(self, asset_pk: int) -> None:
        self.asset_pk = asset_pk

    def __enter__(self) -> AbstractUnitOfWork:
        return self

    def __exit__(self, *args):
        self.rollback()

    def collect_new_events(self) -> Iterator[Event]:
        for asset in self.assets.seen:
            while asset.events:
                yield asset.events.pop(0)

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError


class DjangoUnitOfWork(AbstractUnitOfWork):
    def __enter__(self):
        self.assets = AssetRepository(
            transaction_repository=TransactionRepository(asset_pk=self.asset_pk)
        )
        djtransaction.set_autocommit(False)
        return super().__enter__()

    def __exit__(self, *args):
        super().__exit__(*args)
        djtransaction.set_autocommit(True)

    def commit(self):
        djtransaction.commit()

    def rollback(self):
        djtransaction.rollback()
