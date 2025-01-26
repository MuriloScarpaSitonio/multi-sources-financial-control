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
        label="Ação BR",
        monthly_sell_threshold=settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real,),
        accept_incomes=True,
    )
    stock_usa = ChoiceItem(
        "STOCK_USA",
        label="Ação EUA",
        monthly_sell_threshold=settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.dollar,),
        accept_incomes=True,
    )
    crypto = ChoiceItem(
        "CRYPTO",
        label="Cripto",
        monthly_sell_threshold=settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real, Currencies.dollar),
        accept_incomes=True,  # aceita mesmo?!
    )
    fii = ChoiceItem(
        "FII",
        label="FII",
        monthly_sell_threshold=settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD,
        valid_currencies=(Currencies.real,),
        accept_incomes=True,
    )
    fixed_br = ChoiceItem(
        "FIXED_BR",
        label="Renda fixa BR",
        monthly_sell_threshold=0,
        valid_currencies=(Currencies.real,),
        accept_incomes=False,
    )


class AssetSectors(DjangoChoices):
    industrials = ChoiceItem("INDUSTRIALS", label="Bens industriais")
    communication = ChoiceItem("COMMUNICATION", label="Comunicações")
    non_essential_consumption = ChoiceItem("CONSUMER DISCRETIONARY", label="Consumo não cíclico")
    essential_consumption = ChoiceItem("CONSUMER STAPLES", label="Consumo cíclico")
    finance = ChoiceItem("FINANCIALS", label="Financeiro")
    materials = ChoiceItem("MATERIALS", label="Materiais básicos")
    raw_energy = ChoiceItem("RAW ENERGY", label="Petróleo e derivados")
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
    reimbursement = ChoiceItem("REIMBURSEMENT", label="Reembolso")


class PassiveIncomeEventTypes(DjangoChoices):
    provisioned = ChoiceItem("PROVISIONED", label="Provisionado")
    credited = ChoiceItem("CREDITED", label="Creditado")


class AssetsReportsAggregations(DjangoChoices):
    type = ChoiceItem(
        "type",
        label="Categoria",
        serializer_name="AssetTypeReportSerializer",
    )
    sector = ChoiceItem(
        "sector",
        label="Setor",
        serializer_name="AssetTotalInvestedBySectorReportSerializer",
    )
    objective = ChoiceItem(
        "objective",
        label="Objetivo",
        serializer_name="AssetTotalInvestedByObjectiveReportSerializer",
    )


class AssetReportsKinds(DjangoChoices):
    total_invested = ChoiceItem("total_invested", label="Total investido")
    roi = ChoiceItem("roi", label="ROI")


class AssetStatus(DjangoChoices):
    opened = ChoiceItem("OPENED", label="Aberto")
    closed = ChoiceItem("CLOSED", label="Finalizado")
