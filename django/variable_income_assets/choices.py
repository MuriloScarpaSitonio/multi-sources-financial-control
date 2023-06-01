from django.conf import settings
from django.core.exceptions import ValidationError

from djchoices import DjangoChoices, ChoiceItem


class DjangoChoicesCustomValidator(DjangoChoices):
    @classmethod
    def custom_validator(cls, value: str) -> None:
        # This way we don't create a new migration if any of the choices changes
        if value not in cls.values:
            raise ValidationError(
                "'%(value)s' is not a valid choice for {class_name}. Valid values: {valid_values}",
                params={
                    "value": value,
                    "class_name": cls.__name__,
                    "valid_values": ", ".join(cls.values),
                },
            )


class TransactionActions(DjangoChoicesCustomValidator):
    buy = ChoiceItem("BUY", label="Compra")
    sell = ChoiceItem("SELL", label="Venda")


class TransactionCurrencies(DjangoChoicesCustomValidator):
    real = ChoiceItem("BRL", label="Real", symbol="R$")
    dollar = ChoiceItem("USD", label="Dólar", symbol="US$")


class AssetTypes(DjangoChoicesCustomValidator):
    stock = ChoiceItem(
        "STOCK",
        label="Ação B3",
        monthly_sell_threshold=settings.STOCKS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
    )
    stock_usa = ChoiceItem(
        "STOCK_USA",
        label="Ação EUA",
        monthly_sell_threshold=settings.STOCKS_USA_MONTHLY_SELL_EXEMPTION_THRESHOLD,
    )
    crypto = ChoiceItem(
        "CRYPTO",
        label="Criptoativos",
        monthly_sell_threshold=settings.CRYPTOS_MONTHLY_SELL_EXEMPTION_THRESHOLD,
    )
    fii = ChoiceItem(
        "FII",
        label="Fundo de Investimento Imobiliário",
        monthly_sell_threshold=settings.FII_MONTHLY_SELL_EXEMPTION_THRESHOLD,
    )


ASSET_TYPE_CURRENCY_MAP = {
    AssetTypes.stock: TransactionCurrencies.real,
    AssetTypes.stock_usa: TransactionCurrencies.dollar,
    AssetTypes.fii: TransactionCurrencies.real,
    AssetTypes.crypto: TransactionCurrencies.real,  # best effort strategy
}


# TODO: add validation for `valid_types`
class AssetSectors(DjangoChoicesCustomValidator):
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


class AssetObjectives(DjangoChoicesCustomValidator):
    growth = ChoiceItem("GROWTH", label="Crescimento")
    dividend = ChoiceItem("DIVIDEND", label="Dividendo")
    unknown = ChoiceItem("UNKNOWN", label="Desconhecido")


# TODO: add validation for `valid_types`
class PassiveIncomeTypes(DjangoChoicesCustomValidator):
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


class PassiveIncomeEventTypes(DjangoChoicesCustomValidator):
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
