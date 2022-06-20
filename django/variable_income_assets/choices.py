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


class AssetSectors(DjangoChoices):
    industrials = ChoiceItem(
        "INDUSTRIALS",
        label="Bens industriais",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    communication = ChoiceItem(
        "COMMUNICATION", label="Comunicações", valid_assets=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    non_essential_consumption = ChoiceItem(
        "CONSUMER DISCRETIONARY",
        label="Consumo cíclico",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    essential_consumption = ChoiceItem(
        "CONSUMER STAPLES",
        label="Consumo não cíclico",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    finance = ChoiceItem(
        "FINANCIALS", label="Financeiro", valid_assets=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    materials = ChoiceItem(
        "MATERIALS",
        label="Materiais básicos",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    raw_energy = ChoiceItem(
        "RAW ENERGY",
        label="Petróleo, gás e biocombustíveis",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    health = ChoiceItem(
        "HEALTH CARE", label="Saúde", valid_assets=(AssetTypes.stock, AssetTypes.stock_usa)
    )
    tech = ChoiceItem(
        "TECH",
        label="Tecnologia",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.crypto),
    )
    utilities = ChoiceItem(
        "UTILITIES",
        label="Utilidade pública",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


class AssetObjectives(DjangoChoices):
    growth = ChoiceItem("GROWTH", label="Crescimento")
    dividend = ChoiceItem("DIVIDEND", label="Dividendo")
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


class PassiveIncomeTypes(DjangoChoices):
    dividend = ChoiceItem(
        "DIVIDEND",
        label="Dividendo",
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa),
    )
    jcp = ChoiceItem(
        "JCP",
        label="Juros sobre capital próprio",
        valid_assets=(AssetTypes.stock,),
    )
    income = ChoiceItem(
        "INCOME", label="Rendimento", valid_assets=(AssetTypes.fii, AssetTypes.stock)
    )


class PassiveIncomeEventTypes(DjangoChoices):
    provisioned = ChoiceItem("PROVISIONED", label="Provisionado")
    credited = ChoiceItem("CREDITED", label="Creditado")


# class ROYTypeChoices(DjangoChoices):
#     profit = ChoiceItem("PROFIT", label="Lucro", filter_expression={"ROI__gt": 0})
#     losss = ChoiceItem("LOSS", label="perda", filter_expression={"ROI__lt": 0})


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
