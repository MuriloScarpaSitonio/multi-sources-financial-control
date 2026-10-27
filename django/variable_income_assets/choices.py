from django.conf import settings
from django.db.models import TextChoices


class TransactionActions(TextChoices):
    buy = "BUY", "Compra"
    sell = "SELL", "Venda"
    bonificacao = "BONIFICACAO", "Bonificação"


class Currencies(TextChoices):
    real = "BRL", "Real"
    dollar = "USD", "Dólar"

    @property
    def symbol(self) -> str:
        return {self.real: "R$", self.dollar: "US$"}[self]


class AssetTypes(TextChoices):
    stock = "STOCK", "Renda variável BR"
    stock_usa = "STOCK_USA", "Renda variável EUA"
    equity_global = "EQUITY_GLOBAL", "Renda variável Global"
    crypto = "CRYPTO", "Cripto"
    fii = "FII", "FII"
    fixed_br = "FIXED_BR", "Renda fixa BR"

    @property
    def monthly_sell_threshold(self) -> int:
        return {
            self.stock: settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
            self.stock_usa: settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
            self.equity_global: settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
            self.crypto: settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
            self.fii: settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD,
            self.fixed_br: 0,
        }[self]

    @property
    def valid_currencies(self) -> tuple[Currencies, ...]:
        return {
            self.stock: (Currencies.real,),
            self.stock_usa: (Currencies.dollar,),
            self.equity_global: (Currencies.dollar,),
            self.crypto: (Currencies.real, Currencies.dollar),
            self.fii: (Currencies.real,),
            self.fixed_br: (Currencies.real,),
        }[self]

    @property
    def accept_incomes(self) -> bool:
        return self != self.fixed_br


class AssetSectors(TextChoices):
    industrials = "INDUSTRIALS", "Bens industriais"
    communication = "COMMUNICATION", "Comunicações"
    non_essential_consumption = "CONSUMER DISCRETIONARY", "Consumo não cíclico"
    essential_consumption = "CONSUMER STAPLES", "Consumo cíclico"
    finance = "FINANCIALS", "Financeiro"
    materials = "MATERIALS", "Materiais básicos"
    raw_energy = "RAW ENERGY", "Petróleo e derivados"
    health = "HEALTH CARE", "Saúde"
    tech = "TECH", "Tecnologia"
    utilities = "UTILITIES", "Utilidade pública"
    unknown = "UNKNOWN", "Desconhecido"


class AssetObjectives(TextChoices):
    growth = "GROWTH", "Crescimento"
    dividend = "DIVIDEND", "Dividendo"
    unknown = "UNKNOWN", "Desconhecido"


class PassiveIncomeTypes(TextChoices):
    dividend = "DIVIDEND", "Dividendo"
    jcp = "JCP", "Juros sobre capital próprio"
    income = "INCOME", "Rendimento"
    reimbursement = "REIMBURSEMENT", "Reembolso"
    interest = "INTEREST", "Juros"


class PassiveIncomeEventTypes(TextChoices):
    provisioned = "PROVISIONED", "Provisionado"
    credited = "CREDITED", "Creditado"


class AssetsReportsAggregations(TextChoices):
    type = "type", "Categoria"
    sector = "sector", "Setor"
    objective = "objective", "Objetivo"

    @property
    def serializer_name(self) -> str:
        return {
            self.type: "AssetTypeReportSerializer",
            self.sector: "AssetTotalInvestedBySectorReportSerializer",
            self.objective: "AssetTotalInvestedByObjectiveReportSerializer",
        }[self]


class AssetReportsKinds(TextChoices):
    total_invested = "total_invested", "Total investido"
    roi = "roi", "ROI"


class AssetStatus(TextChoices):
    opened = "OPENED", "Aberto"
    closed = "CLOSED", "Finalizado"


class LiquidityTypes(TextChoices):
    daily = "DAILY", "Liquidez Diária"
    at_maturity = "AT_MATURITY", "Somente no Vencimento"


class FixedIncomeIndexers(TextChoices):
    cdi = "CDI", "CDI"
    selic = "SELIC", "Selic"
    ipca = "IPCA", "IPCA"
    prefixed = "PREFIXED", "Prefixado"
