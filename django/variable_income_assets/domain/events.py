from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class Event:
    asset_pk: int
    # do not dispatch the event handler to be executed elsewhere
    # (i.e. to a queue, other system or whatever) but rather execute
    # the logic in the same process/thread
    sync: bool = False
    operation_date: date | None = None
    quantity_diff: Decimal | None = None


@dataclass
class TransactionsCreated(Event):
    new_asset: bool = False


class TransactionUpdated(Event):
    pass


class TransactionDeleted(Event):
    pass


@dataclass
class PassiveIncomeCreated(Event):
    new_asset: bool = False


class PassiveIncomeUpdated(Event):
    pass


class PassiveIncomeDeleted(Event):
    pass


class AssetCreated(Event):
    pass


class AssetUpdated(Event):
    pass


class AssetOperationClosed(Event):
    pass
