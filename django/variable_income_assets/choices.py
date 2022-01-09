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
    income = ChoiceItem("INCOME", label="Rendimento", valid_assets=(AssetTypes.fii,))


class PassiveIncomeEventTypes(DjangoChoices):
    provisioned = ChoiceItem("PROVISIONED", label="Provisionado")
    credited = ChoiceItem("CREDITED", label="Creditado")


# class ROYTypeChoices(DjangoChoices):
#     profit = ChoiceItem("PROFIT", label="Lucro", filter_expression={"ROI__gt": 0})
#     losss = ChoiceItem("LOSS", label="perda", filter_expression={"ROI__lt": 0})
