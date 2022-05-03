from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterator

from pymongo.client_session import ClientSession as MongoSession

from ..adapters.repository import AbstractCommandRepository, MongoCommandRepository
from ..domain.models import Revenue


class AbstractUnitOfWork(ABC):
    revenues: AbstractCommandRepository

    def __init__(self, *, user_id: int) -> None:
        self.user_id = user_id

    def __enter__(self) -> AbstractUnitOfWork:
        return self

    def __exit__(self, *args):
        self.rollback()

    def commit(self):
        self._commit()

    def collect_new_events(self) -> Iterator[Revenue]:
        for revenue in self.revenues.seen:
            while revenue.events:
                yield revenue.events.pop(0)

    @abstractmethod
    def _commit(self):  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def rollback(self):  # pragma: no cover
        raise NotImplementedError


#! Mongo does not support transactions on a single process, only in replicasets
class MongoUnitOfWork(AbstractUnitOfWork):
    revenues: MongoCommandRepository

    def __init__(self, *, user_id: int, session: MongoSession):
        super().__init__(user_id=user_id)
        self.session = session

    def __enter__(self) -> MongoUnitOfWork:
        # self.session.start_transaction()
        self.revenues = MongoCommandRepository(user_id=self.user_id, session=self.session)
        return super().__enter__()

    def _commit(self):
        # self.session.commit_transaction()
        pass

    def rollback(self):
        # self.session.abort_transaction()
        pass
