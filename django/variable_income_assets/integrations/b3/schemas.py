from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class B3FixedIncomeKind(StrEnum):
    CDB = "CDB"
    LCI = "LCI"
    LIG = "LIG"
    OTHER = "OTHER"


class B3FixedIncomeAction(StrEnum):
    BUY = "BUY"
    SELL = "SELL"


class B3FixedIncomePosition(BaseModel):
    kind: B3FixedIncomeKind
    description: str
    issuer: str | None
    code: str | None
    indexer: str | None
    issue_date: date | None
    maturity_date: date | None
    quantity: Decimal
    current_price: Decimal | None

    model_config = ConfigDict(frozen=True)


class B3FixedIncomeMovement(BaseModel):
    kind: B3FixedIncomeKind
    code: str
    action: B3FixedIncomeAction
    operation_date: date
    quantity: Decimal
    unit_price: Decimal

    model_config = ConfigDict(frozen=True)


class B3TesouroPosition(BaseModel):
    name: str
    isin: str
    indexer: str | None
    maturity_date: date | None
    quantity: Decimal
    current_value: Decimal | None

    model_config = ConfigDict(frozen=True)

    @property
    def current_price(self) -> Decimal | None:
        if self.current_value is None or self.quantity == 0:
            return None
        return self.current_value / self.quantity


class B3TesouroMovement(BaseModel):
    name: str
    action: B3FixedIncomeAction
    operation_date: date
    quantity: Decimal
    unit_price: Decimal

    model_config = ConfigDict(frozen=True)


class B3StockPosition(BaseModel):
    type: str
    code: str
    description: str
    tipo: str | None
    quantity: Decimal
    closing_price: Decimal | None
    current_value: Decimal | None

    model_config = ConfigDict(frozen=True)


class B3StockNegotiation(BaseModel):
    code: str
    action: B3FixedIncomeAction
    operation_date: date
    quantity: Decimal
    price: Decimal

    model_config = ConfigDict(frozen=True)
