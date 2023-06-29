from datetime import date
from decimal import Decimal, DecimalException
from typing import Dict, Literal, Optional, Union, TYPE_CHECKING

from pydantic import BaseModel, condecimal, Field, validator
from cei_crawler.models import (
    AssetExtractAction,
    AssetExtractMarketType,
    PassiveIncomeEventType,
    PassiveIncomeType,
)

from .constants import DEFAULT_BINANCE_CURRENCY

if TYPE_CHECKING:
    from pydantic.typing import CallableGenerator


class NotFoundResponse(BaseModel):
    detail: str


class CeiTransaction(BaseModel):
    operation_date: date
    action: AssetExtractAction
    market_type: AssetExtractMarketType
    raw_negotiation_code: str
    asset_specification: str
    unit_amount: int
    unit_price: Decimal
    total_price: Decimal
    quotation_factor: int


class PassiveIncome(BaseModel):
    raw_negotiation_name: str
    asset_specification: str
    raw_negotiation_code: str
    operation_date: date
    event_type: PassiveIncomeEventType
    unit_amount: int
    quotation_factor: int
    gross_value: Decimal
    net_value: Decimal
    income_type: PassiveIncomeType


class AssetFetchCurrentPriceFilterSet(BaseModel):
    code: str
    type: str
    currency: str


class UpperStr(str):
    @classmethod
    def __get_validators__(cls) -> "CallableGenerator":
        yield cls.to_upper

    @classmethod
    def to_upper(cls, value: str) -> str:
        return value.upper()


class KuCoinOrder(BaseModel):
    id: str
    symbol: str
    code: Optional[str]
    currency: Optional[str]
    side: UpperStr = Field(alias="action")
    dealFunds: Decimal
    dealSize: Decimal = Field(alias="quantity")
    price: condecimal(max_digits=13, decimal_places=6)
    createdAt: float = Field(alias="created_at")

    class Config:
        allow_population_by_field_name = True
        exclude = {"dealFunds", "symbol"}

    def dict(self, **kwargs) -> Dict[str, Union[str, Decimal, int]]:
        exclude = getattr(self.Config, "exclude", None)
        kwargs["exclude"] = (
            kwargs["exclude"] + exclude if kwargs.get("exclude") is not None else exclude
        )
        return super().dict(**kwargs)

    @validator("price")
    def convert_price(cls, _, values: Dict[str, Union[str, Decimal, None]]) -> Decimal:
        try:
            price = values["dealFunds"] / values["dealSize"]
        except DecimalException:
            price = Decimal()
        return price.quantize(Decimal("1.000000"))

    @validator("code", always=True)
    def convert_code(cls, _, values: Dict[str, str]) -> str:
        return values["symbol"].split("-")[0]

    @validator("currency", always=True)
    def convert_currency(cls, _, values: Dict[str, str]) -> str:
        return values["symbol"].split("-")[1]

    @validator("createdAt")
    def convert_created_at(cls, v: int) -> float:
        # divide by 1000 to convert from milliseconds to seconds
        return v / 1000


class BinanceTradeTransaction(BaseModel):
    clientOrderId: str = Field(alias="id")
    symbol: str
    code: Optional[str]
    currency: Optional[str]
    executedQty: Decimal = Field(alias="quantity")
    cummulativeQuoteQty: Decimal
    price: Decimal
    side: str = Field(alias="action")
    time: float = Field(alias="created_at")

    class Config:
        allow_population_by_field_name = True
        exclude = {"symbol", "cummulativeQuoteQty"}

    def dict(self, **kwargs) -> Dict[str, Union[str, Decimal, int]]:
        exclude = getattr(self.Config, "exclude", None)
        kwargs["exclude"] = (
            kwargs["exclude"] + exclude if kwargs.get("exclude") is not None else exclude
        )
        return super().dict(**kwargs)

    @validator("clientOrderId")
    def convert_id(cls, v: int) -> float:
        return v.split("web_")[1]

    @validator("code", always=True)
    def convert_code(cls, _, values: Dict[str, str]) -> str:
        return values["symbol"].split(DEFAULT_BINANCE_CURRENCY)[0]

    @validator("price")
    def convert_price(cls, _, values: Dict[str, Union[str, Decimal]]) -> Decimal:
        try:
            price = values["cummulativeQuoteQty"] / values["executedQty"]
        except DecimalException:
            price = Decimal()
        return price.quantize(Decimal("1.000000"))

    @validator("currency", always=True)
    def convert_currency(cls, _, values: Dict[str, str]) -> str:
        if len(values["symbol"].split(DEFAULT_BINANCE_CURRENCY)) == 2:
            return DEFAULT_BINANCE_CURRENCY
        return "Unknown"

    @validator("time")
    def convert_time(cls, v: int) -> float:
        # divide by 1000 to convert from milliseconds to seconds
        return v / 1000


class BinanceFiatTransaction(BaseModel):
    orderNo: str = Field(alias="id")
    cryptoCurrency: str = Field(alias="code")
    fiatCurrency: str = Field(alias="currency")
    obtainAmount: Decimal = Field(alias="quantity")
    price: Decimal
    action: str
    createTime: float = Field(alias="created_at")

    class Config:
        allow_population_by_field_name = True

    @validator("createTime")
    def convert_time(cls, v: int) -> float:
        # divide by 1000 to convert from milliseconds to seconds
        return v / 1000


class BinanceTransaction(BaseModel):
    id: str
    code: str
    currency: str
    quantity: Decimal
    price: Decimal
    action: Literal["BUY", "SELL"]
    created_at: float
