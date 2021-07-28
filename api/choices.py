from djchoices import DjangoChoices, ChoiceItem


class TransactionOptions(DjangoChoices):
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
        valid_assets=(AssetTypes.stock, AssetTypes.stock_usa, AssetTypes.fii),
    )
    jcp = ChoiceItem(
        "JCP",
        label="Juros sobre capital próprio",
        valid_assets=(AssetTypes.stock,),
    )
