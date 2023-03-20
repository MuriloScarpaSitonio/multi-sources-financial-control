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


@dataclass
class PassiveIncomeCreated(_AssetReadModelEvent):
    pass
