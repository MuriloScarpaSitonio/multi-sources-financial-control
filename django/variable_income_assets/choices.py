from djchoices import DjangoChoices, ChoiceItem


class TransactionActions(DjangoChoices):
    buy = ChoiceItem("BUY", label="Compra")
    sell = ChoiceItem("SELL", label="Venda")


class TransactionCurrencies(DjangoChoices):
    real = ChoiceItem("BRL", label="Real")
    dollar = ChoiceItem("USD", label="Dólar")


class AssetTypes(DjangoChoices):
    stock = ChoiceItem("STOCK", label="Ação B3")
    stock_usa = ChoiceItem("STOCK_USA", label="Ação EUA")
    crypto = ChoiceItem("CRYPTO", label="Criptoativos")
    fii = ChoiceItem("FII", label="Fundo de Investimento Imobiliário")


ASSET_TYPE_CURRENCY_MAP = {
    AssetTypes.stock: TransactionCurrencies.real,
    AssetTypes.stock_usa: TransactionCurrencies.dollar,
    AssetTypes.fii: TransactionCurrencies.real,
    AssetTypes.crypto: TransactionCurrencies.real,  # best effort strategy
}


# TODO: add validation for `valid_types`
class AssetSectors(DjangoChoices):
    industrials = ChoiceItem(
        "INDUSTRIALS",
        label="Bens industriais",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    communication = ChoiceItem(
        "COMMUNICATION", label="Comunicações", valid_types=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    non_essential_consumption = ChoiceItem(
        "CONSUMER DISCRETIONARY",
        label="Consumo não cíclico",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    essential_consumption = ChoiceItem(
        "CONSUMER STAPLES",
        label="Consumo cíclico",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    finance = ChoiceItem(
        "FINANCIALS", label="Financeiro", valid_types=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    materials = ChoiceItem(
        "MATERIALS",
        label="Materiais básicos",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    raw_energy = ChoiceItem(
        "RAW ENERGY",
        label="Petróleo, gás e biocombustíveis",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    health = ChoiceItem(
        "HEALTH CARE", label="Saúde", valid_types=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    tech = ChoiceItem(
        "TECH",
        label="Tecnologia",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.crypto),
    )
    utilities = ChoiceItem(
        "UTILITIES",
        label="Utilidade pública",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    # investment_funds = ChoiceItem(
    #     "INVESTMENT FUNDS", label="Utilidade pública", valid_types=(AssetTypes.fii,)
    # )
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


class AssetObjectives(DjangoChoices):
    growth = ChoiceItem("GROWTH", label="Crescimento")
    dividend = ChoiceItem("DIVIDEND", label="Dividendo")
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


# TODO: add validation for `valid_types`
class PassiveIncomeTypes(DjangoChoices):
    dividend = ChoiceItem(
        "DIVIDEND",
        label="Dividendo",
        valid_types=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    jcp = ChoiceItem(
        "JCP",
        label="Juros sobre capital próprio",
        valid_types=(AssetTypes.stock,),
    )
    income = ChoiceItem(
        "INCOME", label="Rendimento", valid_types=(AssetTypes.fii, AssetTypes.stock)
    )


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
