from datetime import date, datetime, timezone
from decimal import Decimal, DecimalException
from typing import Annotated

from pydantic import AfterValidator, ConfigDict, Field, computed_field

from django.conf import settings

from ...choices import Currencies
from ..schemas import TransactionFromIntegration


class KuCoinTransaction(TransactionFromIntegration):
    id: str
    symbol: str = Field(exclude=True)
    side: Annotated[str, AfterValidator(str.upper)] = Field(alias="action")
    dealFunds: Decimal = Field(exclude=True)
    dealSize: Decimal = Field(alias="quantity")
    createdAt: float = Field(exclude=True)

    model_config = ConfigDict(populate_by_name=True)

    @computed_field
    @property
    def price(self) -> Decimal:
        try:
            p = self.dealFunds / self.dealSize
        except DecimalException:
            p = Decimal()
        return p.quantize(Decimal("1.000000"))

    @computed_field
    @property
    def code(self) -> str:
        return self.symbol.split("-")[0]

    @computed_field
    @property
    def currency(self) -> str:
        c = self.symbol.split("-")[1]
        return Currencies.dollar if c in settings.USD_CRYPTO_SYMBOLS else c

    @computed_field
    @property
    def operation_date(self) -> date:
        # divide by 1000 to convert from milliseconds to seconds
        return datetime.fromtimestamp(self.createdAt / 1000, tz=timezone.utc).date()
