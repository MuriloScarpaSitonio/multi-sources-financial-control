from decimal import Decimal, DecimalException

from pydantic import BaseModel, condecimal, Field, validator


class UpperStr(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.to_upper

    @classmethod
    def to_upper(cls, value: str) -> str:
        return value.upper()


class KuCoinOrder(BaseModel):
    id: str
    symbol: str
    code: str | None
    currency: str | None
    side: UpperStr = Field(alias="action")
    dealFunds: Decimal
    dealSize: Decimal = Field(alias="quantity")
    price: condecimal(max_digits=13, decimal_places=6)
    createdAt: float = Field(alias="operation_date")

    class Config:
        allow_population_by_field_name = True
        exclude = {"dealFunds", "symbol"}

    def model_dump(self, **kwargs) -> dict[str, str | Decimal | int]:
        exclude = getattr(self.Config, "exclude", None)
        kwargs["exclude"] = (
            kwargs["exclude"] + exclude if kwargs.get("exclude") is not None else exclude
        )
        return super().model_dump(**kwargs)

    @validator("price")
    def convert_price(cls, _, values: dict[str, str | Decimal | None]) -> Decimal:
        try:
            price = values["dealFunds"] / values["dealSize"]
        except DecimalException:
            price = Decimal()
        return price.quantize(Decimal("1.000000"))

    @validator("code", always=True)
    def convert_code(cls, _, values: dict[str, str]) -> str:
        return values["symbol"].split("-")[0]

    @validator("currency", always=True)
    def convert_currency(cls, _, values: dict[str, str]) -> str:
        return values["symbol"].split("-")[1]

    @validator("createdAt")
    def convert_coperation_date(cls, v: int) -> float:
        # divide by 1000 to convert from milliseconds to seconds
        return v / 1000
