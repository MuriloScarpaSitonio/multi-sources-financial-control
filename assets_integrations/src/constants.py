from enum import Enum, IntEnum


class AssetTypes(Enum):
    STOCK = FII = "STOCK"
    STOCK_USA = "STOCK_USA"
    CRYPTO = "CRYPTO"


class BinanceFiatPaymentTransactionType(IntEnum):
    BUY = 0
    SELL = 1


DEFAULT_BINANCE_CURRENCY = "BRL"
