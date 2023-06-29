from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict
from decimal import Decimal
from typing import Any, Iterable, TYPE_CHECKING

from django.db.models import F, OuterRef, Subquery
from django.db.models.functions import Coalesce

from ..domain.models import Asset as AssetDomainModel, TransactionDTO

if TYPE_CHECKING:
    from datetime import datetime

    from django.db.models import QuerySet

    from ..choices import AssetSectors, AssetTypes, TransactionCurrencies
    from ..models import AssetMetaData, Transaction


class AbstractTransactionRepository(ABC):
    def __init__(self, asset_pk: int) -> None:
        self.asset_pk = asset_pk
        self.seen: set[Transaction] = set()

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
        from ..models import Transaction

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

        self.seen: set[AssetDomainModel] = set()


class AbstractAssetMetaDataRepository(ABC):
    def __init__(
        self,
        code: str | None = None,
        type: AssetTypes | None = None,
        currency: TransactionCurrencies | None = None,
    ) -> None:
        self.code = code
        self.type = type
        self.currency = currency

    @abstractmethod
    def filter_one(self) -> Any:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def exists(self) -> bool:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def get(self) -> Any:  # pragma: no cover
        raise NotImplementedError

    @abstractmethod
    def create(self) -> Any:  # pragma: no cover
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def filter_assets_eligible_for_update() -> Any:  # pragma: no cover
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    async def abulk_update(objs: Iterable[Any], fields: tuple[str, ...]) -> Any:  # pragma: no cover
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def get_current_price_annotation() -> Any:  # pragma: no cover
        raise NotImplementedError


class DjangoSQLAssetMetaDataRepository(AbstractAssetMetaDataRepository):
    def __init__(
        self,
        code: str | None = None,
        type: AssetTypes | None = None,
        currency: TransactionCurrencies | None = None,
    ) -> None:
        super().__init__(code=code, type=type, currency=currency)

    def filter_one(self) -> QuerySet[AssetMetaData]:
        from ..models import AssetMetaData

        return AssetMetaData.objects.filter(
            code=self.code,
            type=self.type,
            currency=self.currency,
        )

    def exists(self) -> bool:
        return self.filter_one().exists()

    def get(self, *fields: tuple[str, ...]) -> AssetMetaData:
        return self.filter_one().only(*fields).get()

    def create(
        self, sector: AssetSectors, current_price: Decimal, current_price_updated_at: datetime
    ) -> AssetMetaData:
        from ..models import AssetMetaData

        return AssetMetaData.objects.create(
            code=self.code,
            type=self.type,
            currency=self.currency,
            sector=sector,
            current_price=current_price,
            current_price_updated_at=current_price_updated_at,
        )

    @staticmethod
    def filter_assets_eligible_for_update() -> QuerySet[AssetMetaData]:
        from ..models import AssetMetaData

        return (
            AssetMetaData.objects.filter(user_read_assets__quantity_balance__gt=0)
            .only("pk", "code", "type", "currency")
            .distinct()
        )

    @staticmethod
    async def abulk_update(objs: Iterable[AssetMetaData], fields: tuple[str, ...]) -> int:
        from ..models import AssetMetaData

        return await AssetMetaData.objects.abulk_update(objs=objs, fields=fields)

    @staticmethod
    def get_current_price_annotation(fk_connection: bool = True) -> F | Coalesce:
        from ..models import AssetMetaData

        return (
            F("metadata__current_price")
            if fk_connection
            else Coalesce(
                Subquery(
                    AssetMetaData.objects.filter(
                        code=OuterRef("asset__code"),
                        type=OuterRef("asset__type"),
                        currency=OuterRef("currency"),
                    ).values("current_price")[:1]
                ),
                Decimal(),
            )
        )
