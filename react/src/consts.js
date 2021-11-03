const BaseApiUrl =
  process.env.REACT_APP_BaseApiUrl || "http://127.0.0.1:8000/api/v1";

const ExpensesCategoriesMapping = [
  { label: "Alimentação", value: "FOOD" },
  { label: "Casa", value: "HOUSE" },
  { label: "CNPJ", value: "CNPJ" },
  { label: "Lazer", value: "RECREATION" },
  { label: "Presentes", value: "GIFT" },
  { label: "Roupas", value: "CLOTHES" },
  { label: "Saúde", value: "HEALTHCARE" },
  { label: "Supermercado", value: "SUPERMARKET" },
  { label: "Transporte", value: "TRANSPORT" },
  { label: "Viagem", value: "TRIP" },
  { label: "Outros", value: "OTHER" },
];

const ExpensesSourcesMapping = [
  { label: "Boleto", value: "BANK_SLIP" },
  { label: "Cartão de crédito", value: "CREDIT_CARD" },
  { label: "Cartão de débito", value: "DEBIT_CARD" },
  { label: "Dinheiro", value: "MONEY" },
  { label: "Settle Up", value: "SETTLE_UP" },
  { label: "Transferência bancária", value: "BANK_TRANSFER" },
];

const ExpensesChoicesMapping = {
  ...ExpensesCategoriesMapping,
  ...ExpensesSourcesMapping,
};

const AccessTokenStr = "accessToken";
const RefreshTokenStr = "refreshToken";

export {
  BaseApiUrl,
  ExpensesChoicesMapping,
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
  AccessTokenStr,
  RefreshTokenStr,
};
