from typing import TypedDict


class _SnapshotVosBalance(TypedDict):
    asset: str
    free: str
    locked: str


class _SnapshotVosData(TypedDict):
    balances: list[_SnapshotVosBalance]


class _SnapshotVos(TypedDict):
    data: _SnapshotVosData


class AccountSnapshotResponse(TypedDict):
    code: int  # 200 for success; others are error codes
    msg: str  # error message
    snapshotVos: list[_SnapshotVos]


class _FiatPaymentsData(TypedDict):
    orderNo: str
    sourceAmount: str  # Fiat trade amount
    fiatCurrency: str  # Fiat token
    obtainAmount: str  # Crypto trade amount
    cryptoCurrency: str  # Crypto token
    totalFee: str  # Trade fee
    price: str
    status: str  # Processing, Completed, Failed, Refunded
    paymentMethod: str
    createTime: int
    updateTime: int


class FiatPaymentsResponse(TypedDict):
    code: str
    message: str
    data: list[_FiatPaymentsData]
    total: int
    success: bool


class SymbolOrderResponse(TypedDict):
    symbol: str
    orderId: int
    orderListId: int  # Unless OCO, the value will always be -1
    clientOrderId: str
    price: str
    origQty: str
    executedQty: str
    cummulativeQuoteQty: str
    status: str
    timeInForce: str
    type: str
    side: str
    stopPrice: str
    icebergQty: str
    time: int
    updateTime: int
    isWorking: bool
    origQuoteOrderQty: str
    workingTime: int
    selfTradePreventionMode: str


class FiatPayment(_FiatPaymentsData):
    _type: str


class SymbolOrder(SymbolOrderResponse):
    _type: str
