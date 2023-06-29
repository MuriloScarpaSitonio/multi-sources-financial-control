from enum import IntEnum


class BinanceFiatPaymentTransactionType(IntEnum):
    BUY = 0
    SELL = 1


DEFAULT_BINANCE_CURRENCY = "BRL"
