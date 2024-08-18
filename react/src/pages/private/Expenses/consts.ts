const ExpensesCategoriesMapping = {
  Alimentação: { value: "FOOD", color: "#906ccc" },
  Casa: { value: "HOUSE", color: "#ccc86c" },
  CNPJ: { value: "CNPJ", color: "#cc6cc8" },
  Lazer: { value: "RECREATION", color: "#6cccc6" },
  Presentes: { value: "GIFT", color: "#e6837c" },
  Roupas: { value: "CLOTHES", color: "#729e81" },
  Saúde: { value: "HEALTHCARE", color: "#d9a648" },
  Supermercado: { value: "SUPERMARKET", color: "#818deb" },
  Transporte: { value: "TRANSPORT", color: "#c9b671" },
  Viagem: { value: "TRIP", color: "#d984cc" },
  Outros: { value: "OTHER", color: "#d9d3c5" },
};

const ExpensesSourcesMapping = {
  Boleto: { value: "BANK_SLIP", color: "#906ccc" },
  "Cartão de crédito": { value: "CREDIT_CARD", color: "#ccc86c" },
  "Cartão de débito": { value: "DEBIT_CARD", color: "#cc6cc8" },
  Dinheiro: { value: "MONEY", color: "#6cccc6" },
  "Settle Up": { value: "SETTLE_UP", color: "#e6837c" },
  "Transferência bancária": { value: "BANK_TRANSFER", color: "#729e81" },
};

const ExpensesTypesMapping = {
  Fixo: { value: "is_fixed=true", color: "#906ccc" },
  Variável: { value: "is_fixed=false", color: "#ccc86c" },
};

export const ExpenseOptionsProperties: {
  [key: string]: { value: string; color: string };
} = {
  ...ExpensesCategoriesMapping,
  ...ExpensesSourcesMapping,
  ...ExpensesTypesMapping,
};
