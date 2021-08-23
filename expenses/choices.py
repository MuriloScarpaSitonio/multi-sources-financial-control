from djchoices import DjangoChoices, ChoiceItem


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
    other = ChoiceItem("OTHER", label="Outros")


class ExpenseSource(DjangoChoices):
    credit_card = ChoiceItem("CREDIT_CARD", label="Cartão de crédito")
    debit_card = ChoiceItem("DEBIT_CARD", label="Cartão de débito")
    bank_transker = ChoiceItem("BANK_TRANSFER", label="Transferência bancária")
    money = ChoiceItem("MONEY", label="Dinheiro")
    bank_slip = ChoiceItem("BANK_SLIP", label="Boleto")
    settle_up = ChoiceItem("SETTLE_UP", label="Settle Up")
