from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterator

from sqlmodel import Session

from ..adapters.repository import AbstractCommandRepository, SqlModelCommandRepository
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


class SqlModelUnitOfWork(AbstractUnitOfWork):
    revenues: SqlModelCommandRepository

    def __init__(self, *, user_id: int, session: Session):
        super().__init__(user_id=user_id)
        self.session = session

    def __enter__(self) -> SqlModelUnitOfWork:
        self.revenues = SqlModelCommandRepository(user_id=self.user_id, session=self.session)
        return super().__enter__()

    def __exit__(self, *args):
        super().__exit__(*args)
        self.session.close()

    def _commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
