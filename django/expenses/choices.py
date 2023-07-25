from djchoices import ChoiceItem, DjangoChoices


class ExpenseCategory(DjangoChoices):
    recreation = ChoiceItem("RECREATION", label="Lazer")
    supermarket = ChoiceItem("SUPERMARKET", label="Supermercado")
    food = ChoiceItem("FOOD", label="Alimentação")
    clothes = ChoiceItem("CLOTHES", label="Roupas")
    gift = ChoiceItem("GIFT", label="Presentes")
    healthcare = ChoiceItem("HEALTHCARE", label="Saúde")
    house = ChoiceItem("HOUSE", label="Casa")
    transport = ChoiceItem("TRANSPORT", label="Transporte")
    trip = ChoiceItem("TRIP", label="Viagem")
    cnpj = ChoiceItem("CNPJ", label="CNPJ")
    other = ChoiceItem("OTHER", label="Outros")


class ExpenseSource(DjangoChoices):
    credit_card = ChoiceItem("CREDIT_CARD", label="Cartão de crédito")
    debit_card = ChoiceItem("DEBIT_CARD", label="Cartão de débito")
    bank_transker = ChoiceItem("BANK_TRANSFER", label="Transferência bancária")
    money = ChoiceItem("MONEY", label="Dinheiro")
    bank_slip = ChoiceItem("BANK_SLIP", label="Boleto")
    settle_up = ChoiceItem("SETTLE_UP", label="Settle Up")


class ExpenseReportType(DjangoChoices):
    type = ChoiceItem(
        "TYPE",
        label="Tipo",
        field_name="is_fixed",
        serializer_name="ExpenseReportTypeSerializer",
    )
    category = ChoiceItem(
        "CATEGORY",
        label="Categoria",
        field_name="category",
        serializer_name="ExpenseReportCategorySerializer",
    )
    source = ChoiceItem(
        "SOURCE",
        label="Fonte",
        field_name="source",
        serializer_name="ExpenseReportSourceSerializer",
    )
