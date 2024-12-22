from djchoices import ChoiceItem, DjangoChoices


class ExpenseReportType(DjangoChoices):
    type = ChoiceItem(
        "type",
        label="Tipo",
        field_name="is_fixed",
        serializer_name="ExpenseReportTypeSerializer",
    )
    category = ChoiceItem(
        "category",
        label="Categoria",
        field_name="category",
        serializer_name="ExpenseReportCategorySerializer",
    )
    source = ChoiceItem(
        "source",
        label="Fonte",
        field_name="source",
        serializer_name="ExpenseReportSourceSerializer",
    )


class Colors(DjangoChoices):
    purple1 = ChoiceItem("#906CCC", label="Roxo 1")
    purple2 = ChoiceItem("#906C96", label="Roxo 2")
    pink1 = ChoiceItem("#CC6CC8", label="Rosa 1")
    pink2 = ChoiceItem("#D6A8D4", label="Rosa 2")
    pink3 = ChoiceItem("#E57A96", label="Rosa 3")
    pink4 = ChoiceItem("#DAADAE", label="Rosa 4")
    red1 = ChoiceItem("#CB5F61", label="Vermelho 1")
    orange1 = ChoiceItem("#CA7F45", label="Laranja 1")
    yellow1 = ChoiceItem("#D8A548", label="Amarelo 1")
    yellow2 = ChoiceItem("#D4C05C", label="Amarelo 2")
    green1 = ChoiceItem("#C6CB9C", label="Verde 1")
    green2 = ChoiceItem("#61A78F", label="Verde 2")
    green3 = ChoiceItem("#6CCCC6", label="Verde 3")
    blue1 = ChoiceItem("#A3C4DA", label="Azul 1")
    blue2 = ChoiceItem("#7A9FE5", label="Azul 2")
    blue3 = ChoiceItem("#5F7CB2", label="Azul 3")


DEFAULT_CATEGORIES_MAP = {
    "Lazer": Colors.green3,
    "Supermercado": Colors.blue1,
    "Alimentação": Colors.purple1,
    "Roupas": Colors.red1,
    "Presentes": Colors.orange1,
    "Saúde": Colors.yellow1,
    "Casa": Colors.pink3,
    "Transporte": Colors.blue3,
    "Viagem": Colors.green3,
    "Outros": Colors.blue2,
}

CREDIT_CARD_SOURCE = "Cartão de crédito"
MONEY_SOURCE = "Dinheiro"
PIX_SOURCE = "Pix"
CATEGORIES_NOT_ALLOWED_IN_FUTURE = (CREDIT_CARD_SOURCE, MONEY_SOURCE, PIX_SOURCE)
DEFAULT_SOURCES_MAP = {
    CREDIT_CARD_SOURCE: Colors.red1,
    MONEY_SOURCE: Colors.green3,
    PIX_SOURCE: Colors.blue1,
    "Cartão de débito": Colors.pink1,
    "Boleto": Colors.orange1,
}


DEFAULT_REVENUE_CATEGORIES_MAP = {
    "Salário": Colors.green3,
    "Bônus": Colors.blue1,
    "Prêmio": Colors.purple1,
    "Presente": Colors.orange1,
    "Outros": Colors.blue2,
}
