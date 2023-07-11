from dataclasses import dataclass


class Event:
    pass


@dataclass
class _AssetReadModelEvent(Event):
    asset_pk: int
    # do not dispatch the event handler to be executed elsewhere
    # (i.e. to a queue, other system or whatever) but rather execute
    # the logic in the same process/thread
    sync: bool = False


@dataclass
class TransactionsCreated(_AssetReadModelEvent):
    new_asset: bool = False


class TransactionUpdated(_AssetReadModelEvent):
    pass


class TransactionDeleted(_AssetReadModelEvent):
    pass


@dataclass
class PassiveIncomeCreated(_AssetReadModelEvent):
    new_asset: bool = False


class PassiveIncomeUpdated(_AssetReadModelEvent):
    pass


class PassiveIncomeDeleted(_AssetReadModelEvent):
    pass


class AssetCreated(_AssetReadModelEvent):
    pass


class AssetUpdated(_AssetReadModelEvent):
    pass
