from enum import IntEnum, StrEnum


class TransactionType(StrEnum):
    FIAT = "FIAT"
    TRADE = "TRADE"


class FiatPaymentTransactionType(IntEnum):
    BUY = 0
    SELL = 1
