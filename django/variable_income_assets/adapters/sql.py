from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import asdict
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Literal, overload

from django.db.models import F, OuterRef, Subquery
from django.db.models.functions import Coalesce

from ..domain.models import Asset as AssetDomainModel
from ..domain.models import PassiveIncomeDTO, TransactionDTO

if TYPE_CHECKING:
    from datetime import date, datetime

    from django.db.models import QuerySet

    from ..choices import AssetSectors, AssetTypes, Currencies
    from ..models import (
        Asset,
        AssetMetaData,
        AssetsTotalInvestedSnapshot,
        PassiveIncome,
        Transaction,
    )

    Entity = Transaction | PassiveIncome | Asset
    EntityDTO = TransactionDTO | PassiveIncomeDTO | AssetDomainModel


class AbstractEntityRepository(ABC):
    def __init__(self, asset_pk: int) -> None:
        self.asset_pk = asset_pk
        self.seen: set[Entity] = set()

    @overload
    @abstractmethod
    def _add(self, dto: TransactionDTO) -> Transaction: ...

    @overload
    @abstractmethod
    def _add(self, dto: PassiveIncomeDTO) -> PassiveIncome: ...

    @overload
    @abstractmethod
    def _add(self, dto: AssetDomainModel) -> Asset: ...

    @abstractmethod
    def _add(self, dto: EntityDTO) -> Entity:
        raise NotImplementedError

    def add(self, dto: EntityDTO) -> None:
        e = self._add(dto=dto)
        self.seen.add(e)

    @overload
    def update(self, dto: TransactionDTO, entity: Transaction) -> None: ...

    @overload
    def update(self, dto: PassiveIncomeDTO, entity: PassiveIncome) -> None: ...

    @overload
    def update(self, dto: AssetDomainModel, entity: Asset) -> None: ...

    def update(self, dto: EntityDTO, entity: Entity) -> None:
        e = self._update(dto=dto, entity=entity)
        self.seen.add(e)

    @overload
    @abstractmethod
    def _update(self, dto: TransactionDTO, entity: Transaction) -> Transaction: ...

    @overload
    @abstractmethod
    def _update(self, dto: PassiveIncomeDTO, entity: PassiveIncome) -> PassiveIncome: ...

    @abstractmethod
    def _update(self, dto: EntityDTO, entity: Entity) -> Entity:
        raise NotImplementedError

    @abstractmethod
    def delete(self, entity: Entity) -> None:
        raise NotImplementedError


class DjangoEntityRepository(AbstractEntityRepository):
    def _update(self, dto: EntityDTO, entity: Entity) -> Entity:
        for key, value in asdict(dto).items():
            setattr(entity, key, value)

        entity.save()
        return entity

    def delete(self, entity: Entity) -> None:
        entity.delete()


class TransactionRepository(DjangoEntityRepository):
    seen: set[Transaction]

    def _add(self, dto: TransactionDTO) -> Transaction:
        from ..models import Transaction

        return Transaction.objects.create(**asdict(dto), asset_id=self.asset_pk)


class PassiveIncomeRepository(DjangoEntityRepository):  # pragma: no cover
    seen: set[PassiveIncome]

    def _add(self, dto: PassiveIncomeDTO) -> PassiveIncome:
        from ..models import PassiveIncome

        return PassiveIncome.objects.create(**asdict(dto), asset_id=self.asset_pk)


class AssetRepository:
    def __init__(
        self,
        transactions_repository: TransactionRepository,
        incomes_repository: PassiveIncomeRepository,
        user_id: int,
    ) -> None:
        self.transactions = transactions_repository
        self.incomes = incomes_repository
        self.user_id = user_id

        self.seen: set[AssetDomainModel] = set()

    def add(self, dto: AssetDomainModel) -> Asset:
        from ..models import Asset

        data = asdict(dto)
        data.pop("id")
        data.pop("is_held_in_self_custody")
        data.pop("quantity_balance")
        data.pop("avg_price")
        data.pop("total_sold")

        asset = Asset.objects.create(**data, user_id=self.user_id)
        dto.id = asset.pk
        self.seen.add(dto)
        return asset

    def update(self, dto: AssetDomainModel, entity: Asset) -> Asset:
        data = asdict(dto)
        data.pop("id")
        data.pop("is_held_in_self_custody")
        data.pop("quantity_balance")
        data.pop("avg_price")
        for key, value in data.items():
            setattr(entity, key, value)

        entity.save()
        self.seen.add(dto)
        return entity

    def exists(self, dto: AssetDomainModel) -> bool:
        from ..models import Asset

        qs = Asset.objects.filter(
            user_id=self.user_id, code=dto.code, type=dto.type, currency=dto.currency
        )
        if pk := dto.id:
            qs = qs.exclude(pk=pk)
        return qs.exists()


class AbstractAssetMetaDataRepository(ABC):
    def __init__(
        self,
        code: str | None = None,
        type: AssetTypes | None = None,
        currency: Currencies | None = None,
        asset_id: int | None = None,
    ) -> None:
        self.code = code
        self.type = type
        self.currency = currency
        self.asset_id = asset_id

    @abstractmethod
    def filter_one(self) -> Any:
        raise NotImplementedError

    @abstractmethod
    def exists(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get(self) -> Any:
        raise NotImplementedError

    @abstractmethod
    def create(self) -> Any:
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def filter_assets_eligible_for_update() -> Any:
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    async def abulk_update(objs: Iterable[Any], fields: tuple[str, ...]) -> Any:
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def get_current_price_annotation() -> Any:
        raise NotImplementedError


class DjangoSQLAssetMetaDataRepository(AbstractAssetMetaDataRepository):
    def __init__(
        self,
        code: str | None = None,
        type: AssetTypes | None = None,
        currency: Currencies | None = None,
        asset_id: int | None = None,
    ) -> None:
        super().__init__(code=code, type=type, currency=currency, asset_id=asset_id)

    def filter_one(self) -> QuerySet[AssetMetaData]:
        from ..models import AssetMetaData

        if self.asset_id:
            return AssetMetaData.objects.filter(asset_id=self.asset_id)
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
            asset_id=self.asset_id,
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
    def get_current_price_annotation(
        source: Literal["write", "read", "transactions"],
    ) -> F | Coalesce:
        if source == "read":
            return F("metadata__current_price")

        from ..models import AssetMetaData

        prefix = "asset__" if source == "transactions" else ""
        return Coalesce(
            Subquery(
                AssetMetaData.objects.filter(
                    code=OuterRef(f"{prefix}code"),
                    type=OuterRef(f"{prefix}type"),
                    currency=OuterRef(f"{prefix}currency"),
                ).values("current_price")[:1]
            ),
            Decimal(),
        )


class AbstractAssetTotalInvestedSnapshotRepository(ABC):
    @abstractmethod
    def update_one(self, user_id: int, operation_date: date, total: Decimal) -> Any:
        raise NotImplementedError

    @abstractmethod
    def exists(self) -> bool:
        raise NotImplementedError


class DjangoSQLAssetTotalInvestedSnapshotRepository(AbstractAssetTotalInvestedSnapshotRepository):
    def update_total_from_diff(
        self, user_id: int, operation_date: date, total_change: Decimal
    ) -> int:
        return AssetsTotalInvestedSnapshot.objects.filter(
            user_id=user_id, operation_date=operation_date
        ).update(total=F("total") + total_change)
