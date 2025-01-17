from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from ..domain.models import Asset as AssetDomainModel


class Event:
    ...


@dataclass
class RelatedAssetEvent(Event):
    asset_pk: int

    # do not dispatch the event handler to be executed elsewhere
    # (i.e. to a queue, other system or whatever) but rather execute
    # the logic in the same process/thread
    sync: bool = False
    #

    operation_date: date | None = None
    quantity_diff: Decimal | None = None


@dataclass
class TransactionsCreated(RelatedAssetEvent):
    new_asset: bool = False
    fixed_br_asset: bool = False
    is_held_in_self_custody: bool = False


class TransactionUpdated(RelatedAssetEvent):
    ...


class TransactionDeleted(RelatedAssetEvent):
    ...


@dataclass
class PassiveIncomeCreated(RelatedAssetEvent):
    new_asset: bool = False


class PassiveIncomeUpdated(RelatedAssetEvent):
    ...


class PassiveIncomeDeleted(RelatedAssetEvent):
    ...


class AssetOperationClosed(RelatedAssetEvent):
    ...


@dataclass
class AssetEvent(Event):
    asset: AssetDomainModel

    # do not dispatch the event handler to be executed elsewhere
    # (i.e. to a queue, other system or whatever) but rather execute
    # the logic in the same process/thread
    sync: bool = False

    def __post_init__(self) -> None:
        self.asset_pk = self.asset.id


class AssetCreated(AssetEvent):
    ...


class AssetUpdated(AssetEvent):
    ...
