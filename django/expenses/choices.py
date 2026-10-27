from django.db.models import TextChoices


class ExpenseReportType(TextChoices):
    type = "type", "Tipo"
    category = "category", "Categoria"
    source = "source", "Fonte"

    @property
    def field_name(self) -> str:
        return {self.type: "is_fixed", self.category: "category", self.source: "source"}[self]

    @property
    def serializer_name(self) -> str:
        return {
            self.type: "ExpenseReportTypeSerializer",
            self.category: "ExpenseReportCategorySerializer",
            self.source: "ExpenseReportSourceSerializer",
        }[self]


class Colors(TextChoices):
    purple1 = "#906CCC", "Roxo 1"
    purple2 = "#906C96", "Roxo 2"
    pink1 = "#CC6CC8", "Rosa 1"
    pink2 = "#D6A8D4", "Rosa 2"
    pink3 = "#E57A96", "Rosa 3"
    pink4 = "#DAADAE", "Rosa 4"
    red1 = "#CB5F61", "Vermelho 1"
    orange1 = "#CA7F45", "Laranja 1"
    yellow1 = "#D8A548", "Amarelo 1"
    yellow2 = "#D4C05C", "Amarelo 2"
    green1 = "#C6CB9C", "Verde 1"
    green2 = "#61A78F", "Verde 2"
    green3 = "#6CCCC6", "Verde 3"
    blue1 = "#A3C4DA", "Azul 1"
    blue2 = "#7A9FE5", "Azul 2"
    blue3 = "#5F7CB2", "Azul 3"


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
