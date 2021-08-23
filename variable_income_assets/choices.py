from djchoices import DjangoChoices, ChoiceItem


class TransactionActions(DjangoChoices):
    buy = ChoiceItem("BUY", label="Compra")
    sell = ChoiceItem("SELL", label="Venda")


class AssetTypes(DjangoChoices):
    stock = ChoiceItem("STOCK", label="Ação B3")
    stock_usa = ChoiceItem("STOCK USA", label="Ação EUA")
    cripto = ChoiceItem("CRIPTO", label="Criptoativos")
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


"""class ROYTypeChoices(DjangoChoices):
    profit = ChoiceItem("PROFIT", label="Lucro", filter_expression={"ROI__gt": 0})
    losss = ChoiceItem("LOSS", label="perda", filter_expression={"ROI__lt": 0})"""
