from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel

from ...choices import TransactionActions
from ...domain.models import TransactionDTO


class AssetTradingSide(str, Enum):
    VENDA = "Venda"
    COMPRA = "Compra"


class AssetTradingMarket(str, Enum):
    FUTURO = "Futuro"
    RENDA_FIXA = "Renda Fixa"
    MERCADO_A_VISTA = "Mercado à Vista"
    TERMO_DE_ACAO = "Termo de Ação"
    OPCAO_DE_VENDA_SOBRE_ACOES = "Opção de Venda sobre Ações"
    MERCADO_DE_GRANDES_LOTES = "Mercado de Grandes Lotes"
    SPOT = "Spot"
    OPCAO_DE_COMPRA_SOBRE_ACOES = "Opção de Compra sobre Ações"
    MERCADO_FRACIONARIO = "Mercado Fracionário"

    def is_skippable(self) -> bool:
        return self in (
            AssetTradingMarket.FUTURO,
            AssetTradingMarket.TERMO_DE_ACAO,
            AssetTradingMarket.OPCAO_DE_COMPRA_SOBRE_ACOES,
            AssetTradingMarket.OPCAO_DE_VENDA_SOBRE_ACOES,
        )


class AssetTrading(BaseModel):
    ticker_symbol: str
    side: AssetTradingSide
    market_name: AssetTradingMarket
    trade_quantity: int
    price_value: Decimal
    gross_amount: Decimal
    reference_date: date
    trade_date_time: datetime | None = None

    def is_skippable(self) -> bool:
        return self.market_name.is_skippable()

    def as_dto(self) -> TransactionDTO:
        return TransactionDTO(
            action=(
                TransactionActions.sell
                if self.side == AssetTradingSide.VENDA
                else TransactionActions.buy
            ),
            operation_date=(
                self.trade_date_time.date() if self.trade_date_time else self.reference_date
            ),
            quantity=self.gross_amount,
            price=self.price_value,
        )
