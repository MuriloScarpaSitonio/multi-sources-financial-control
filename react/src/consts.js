const BaseApiUrl = process.env.REACT_APP_BaseApiUrl || "http://127.0.0.1:8000/api/v1"

const ExpensesCategoriesMapping = [
    { label: "Lazer", value: "RECREATION" },
    { label: "Casa", value: "HOUSE" },
    { label: "Transporte", value: "TRANSPORT" },
    { label: "Supermercado", value: "SUPERMARKET" },
    { label: "Alimentação", value: "FOOD" },
    { label: "Roupas", value: "CLOTHES" },
    { label: "Presentes", value: "GIFT" },
    { label: "Saúde", value: "HEALTHCARE" },
    { label: "Viagem", value: "TRIP" },
    { label: "Outros", value: "OTHER" },
]

const ExpensesSourcesMapping = [
    { label: "Cartão de crédito", value: "CREDIT_CARD" },
    { label: "Cartão de débito", value: "DEBIT_CARD" },
    { label: "Transferência bancária", value: "BANK_TRANSFER" },
    { label: "Dinheiro", value: "MONEY" },
    { label: "Boleto", value: "BANK_SLIP" },
    { label: "Settle Up", value: "SETTLE_UP" },
]

const ExpensesChoicesMapping = { ...ExpensesCategoriesMapping, ...ExpensesSourcesMapping }

const AccessTokenStr = "accessToken"
const RefreshTokenStr = "refreshToken"

export {
    BaseApiUrl, ExpensesChoicesMapping, ExpensesCategoriesMapping,
    ExpensesSourcesMapping, AccessTokenStr, RefreshTokenStr
}