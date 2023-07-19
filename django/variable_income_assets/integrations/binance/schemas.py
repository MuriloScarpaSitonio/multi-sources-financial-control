from datetime import date, datetime, timezone
from decimal import Decimal

from pydantic import ConfigDict, Field, computed_field

from ...choices import Currencies
from ..schemas import TransactionFromIntegration
from .enums import TransactionType


class BinanceTransaction(TransactionFromIntegration):
    orderNo: str | None = None
    orderId: str | int | None = None

    cryptoCurrency: str | None = None
    symbol: str | None = None
    fiatCurrency: str | None = None

    obtainAmount: Decimal | None = None
    executedQty: Decimal | None = None

    price: Decimal
    cummulativeQuoteQty: Decimal | None = None

    side: str = Field(alias="action")

    time: float | None = None
    createTime: float | None = None

    type_: TransactionType

    model_config = ConfigDict(populate_by_name=True)

    @computed_field
    @property
    def id(self) -> str:
        return self.orderNo if self.type_ == TransactionType.FIAT else self.orderId

    @computed_field
    @property
    def code(self) -> str:
        return (
            self.cryptoCurrency
            if self.type_ == TransactionType.FIAT
            else self.symbol.split(Currencies.real)[0]
        )

    @computed_field
    @property
    def quantity(self) -> Decimal:
        return self.obtainAmount if self.type_ == TransactionType.FIAT else self.executedQty

    # TODO: CHECK trade orders price
    # @computed_field
    # @property
    # def price(self) -> Decimal:
    #     try:
    #         p = self.cummulativeQuoteQty / self.executedQty
    #     except DecimalException:
    #         p = Decimal()
    #     return p.quantize(Decimal("1.000000"))

    @computed_field
    @property
    def currency(self) -> str:
        if self.type_ == TransactionType.FIAT:
            return self.fiatCurrency
        if len(self.symbol.split(Currencies.real)) == 2:
            return Currencies.real
        return "Unknown"

    @computed_field
    @property
    def operation_date(self) -> date:
        # divide by 1000 to convert from milliseconds to seconds
        return (
            datetime.fromtimestamp(self.createTime / 1000, tz=timezone.utc).date()
            if self.type_ == TransactionType.FIAT
            else datetime.fromtimestamp(self.time / 1000, tz=timezone.utc).date()
        )
