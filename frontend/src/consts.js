const BaseApiUrl = process.env.REACT_APP_BaseApiUrl || "http://127.0.0.1:8000/api/v1"

const ExpensesCategoriesMapping = {
    "Lazer": "RECREATION",
    "Casa": "HOUSE",
    "Transporte": "TRANSPORT",
    "Supermercado": "SUPERMARKET",
    "Alimentação": "FOOD",
    "Roupas": "CLOTHES",
    "Presentes": "GIFT",
    "Saúde": "HEALTHCARE",
    "Viagem": "TRIP",
    "Outros": "OTHER"
}

const ExpensesSourcesMapping = {
    "Cartão de crédito": "CREDIT_CARD",
    "Cartão de débito": "DEBIT_CARD",
    "Transferência bancária": "BANK_TRANSFER",
    "Dinheiro": "MONEY",
    "Boleto": "BANK_SLIP",
    "Settle Up": "SETTLE_UP"
}

const ExpensesChoicesMapping = { ...ExpensesCategoriesMapping, ...ExpensesSourcesMapping }

const AccessTokenStr = "accessToken"
const RefreshTokenStr = "refreshToken"

export {
    BaseApiUrl, ExpensesChoicesMapping, ExpensesCategoriesMapping,
    ExpensesSourcesMapping, AccessTokenStr, RefreshTokenStr
}