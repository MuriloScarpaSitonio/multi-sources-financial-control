from __future__ import annotations

from abc import ABC, abstractmethod

from sqlmodel import Session

from ..adapters.repository import SqlAlchemyRepository


class AbstractUnitOfWork(ABC):
    def __enter__(self) -> AbstractUnitOfWork:
        return self

    def __exit__(self, *args):
        self.rollback()

    def commit(self):
        self._commit()

    @abstractmethod
    def _commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError


class SqlModelUnitOfWork(AbstractUnitOfWork):
    revenues: SqlAlchemyRepository

    def __init__(self, *, user_id: int, session: Session):
        self.user_id = user_id
        self.session = session

    def __enter__(self) -> AbstractUnitOfWork:
        self.revenues = SqlAlchemyRepository(user_id=self.user_id, session=self.session)
        return super().__enter__()

    def __exit__(self, *args):
        super().__exit__(*args)
        self.session.close()

    def _commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
