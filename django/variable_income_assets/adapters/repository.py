from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict

from typing import Set

from ..domain.models import Asset as AssetDomainModel, TransactionDTO
from ..models import Transaction


class AbstractTransactionRepository(ABC):
    def __init__(self, asset_pk: int) -> None:
        self.asset_pk = asset_pk
        self.seen: Set[Transaction] = set()

    def add(self, dto: TransactionDTO) -> None:
        transaction = self._add(dto=dto)
        self.seen.add(transaction)

    @abstractmethod
    def _add(self, dto: TransactionDTO) -> Transaction:  # pragma: no cover
        raise NotImplementedError

    def update(self, dto: TransactionDTO, transaction: Transaction) -> None:
        t = self._update(dto=dto, transaction=transaction)
        self.seen.add(t)

    @abstractmethod
    def _update(
        self, dto: TransactionDTO, transaction: Transaction
    ) -> Transaction:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def delete(self, transaction: Transaction) -> None:  # pragma: no cover
        raise NotImplementedError


class TransactionRepository(AbstractTransactionRepository):
    def _add(self, dto: TransactionDTO) -> Transaction:
        data = asdict(dto)
        if data["created_at"] is None:
            data.pop("created_at")

        return Transaction.objects.create(**data, asset_id=self.asset_pk)

    def _update(self, dto: TransactionDTO, transaction: Transaction) -> Transaction:
        for key, value in asdict(dto).items():
            setattr(transaction, key, value)

        transaction.save()
        return transaction

    def delete(self, transaction: Transaction) -> None:
        transaction.delete()


class AssetRepository:
    def __init__(self, transaction_repository: TransactionRepository) -> None:
        self.transactions = transaction_repository

        self.seen: Set[AssetDomainModel] = set()
