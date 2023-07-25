from django.conf import settings
from djchoices import ChoiceItem, DjangoChoices


class TransactionActions(DjangoChoices):
    buy = ChoiceItem("BUY", label="Compra")
    sell = ChoiceItem("SELL", label="Venda")


class Currencies(DjangoChoices):
    real = ChoiceItem("BRL", label="Real", symbol="R$")
    dollar = ChoiceItem("USD", label="Dólar", symbol="US$")


class AssetTypes(DjangoChoices):
    stock = ChoiceItem(
        "STOCK",
        label="Ação B3",
        monthly_sell_threshold=settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real,),
    )
    stock_usa = ChoiceItem(
        "STOCK_USA",
        label="Ação EUA",
        monthly_sell_threshold=settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.dollar,),
    )
    crypto = ChoiceItem(
        "CRYPTO",
        label="Criptoativos",
        monthly_sell_threshold=settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real, Currencies.dollar),
    )
    fii = ChoiceItem(
        "FII",
        label="Fundo de Investimento Imobiliário",
        monthly_sell_threshold=settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real,),
    )


class AssetSectors(DjangoChoices):
    industrials = ChoiceItem("INDUSTRIALS", label="Bens industriais")
    communication = ChoiceItem("COMMUNICATION", label="Comunicações")
    non_essential_consumption = ChoiceItem("CONSUMER DISCRETIONARY", label="Consumo não cíclico")
    essential_consumption = ChoiceItem("CONSUMER STAPLES", label="Consumo cíclico")
    finance = ChoiceItem("FINANCIALS", label="Financeiro")
    materials = ChoiceItem("MATERIALS", label="Materiais básicos")
    raw_energy = ChoiceItem("RAW ENERGY", label="Petróleo, gás e biocombustíveis")
    health = ChoiceItem("HEALTH CARE", label="Saúde")
    tech = ChoiceItem("TECH", label="Tecnologia")
    utilities = ChoiceItem("UTILITIES", label="Utilidade pública")
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


class AssetObjectives(DjangoChoices):
    growth = ChoiceItem("GROWTH", label="Crescimento")
    dividend = ChoiceItem("DIVIDEND", label="Dividendo")
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


class PassiveIncomeTypes(DjangoChoices):
    dividend = ChoiceItem("DIVIDEND", label="Dividendo")
    jcp = ChoiceItem("JCP", label="Juros sobre capital próprio")
    income = ChoiceItem("INCOME", label="Rendimento")


class PassiveIncomeEventTypes(DjangoChoices):
    provisioned = ChoiceItem("PROVISIONED", label="Provisionado")
    credited = ChoiceItem("CREDITED", label="Creditado")


class AssetsTotalInvestedReportAggregations(DjangoChoices):
    type = ChoiceItem(
        "TYPE",
        label="Tipo",
        field_name="type",
        serializer_name="AssetTypeReportSerializer",
    )
    sector = ChoiceItem(
        "SECTOR",
        label="Categoria",
        field_name="sector",
        serializer_name="AssetTotalInvestedBySectorReportSerializer",
    )
    objective = ChoiceItem(
        "OBJECTIVE",
        label="Fonte",
        field_name="objective",
        serializer_name="AssetTotalInvestedByObjectiveReportSerializer",
    )
