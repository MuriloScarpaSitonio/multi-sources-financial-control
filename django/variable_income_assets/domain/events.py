from dataclasses import dataclass


class Event:
    pass


@dataclass
class _AssetReadModelEvent(Event):
    asset_pk: int


class TransactionsCreated(_AssetReadModelEvent):
    pass


class TransactionUpdated(_AssetReadModelEvent):
    pass


class TransactionDeleted(_AssetReadModelEvent):
    pass


class PassiveIncomeCreated(_AssetReadModelEvent):
    pass


class PassiveIncomeUpdated(_AssetReadModelEvent):
    pass


class PassiveIncomeDeleted(_AssetReadModelEvent):
    pass


class AssetCreated(_AssetReadModelEvent):
    pass


class AssetUpdated(_AssetReadModelEvent):
    pass
