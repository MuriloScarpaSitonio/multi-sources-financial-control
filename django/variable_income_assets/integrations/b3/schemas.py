from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict

# AssetMetaData.current_price is DecimalField(decimal_places=10).
_PRICE_QUANTUM = Decimal("1.0000000000")


class B3FixedIncomeKind(StrEnum):
    CDB = "CDB"
    LCI = "LCI"
    LIG = "LIG"
    OTHER = "OTHER"


class B3FixedIncomeAction(StrEnum):
    BUY = "BUY"
    SELL = "SELL"


class B3ProventoType(StrEnum):
    DIVIDENDO = "DIVIDENDO"
    JSCP = "JSCP"
    RENDIMENTO = "RENDIMENTO"
    REEMBOLSO = "REEMBOLSO"


class B3Provento(BaseModel):
    code: str
    kind: B3ProventoType
    payment_date: date
    amount: Decimal

    model_config = ConfigDict(frozen=True)


class B3ProventoSkip(BaseModel):
    # A row whose "Tipo de Evento" we don't map (e.g. fixed-income "PAGAMENTO DE
    # JUROS"); surfaced in the report instead of aborting the whole import.
    code: str
    label: str

    model_config = ConfigDict(frozen=True)


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
        return (self.current_value / self.quantity).quantize(
            _PRICE_QUANTUM, rounding=ROUND_HALF_UP
        )


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
