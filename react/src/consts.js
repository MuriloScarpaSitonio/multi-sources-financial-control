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

const AssetsObjectivesMapping = [
  { label: "Crescimento", value: "GROWTH" },
  { label: "Dividendo", value: "DIVIDEND" },
  { label: "Desconhecido", value: "UNKNOWN" },
];

const AssetsSectorsMapping = [
  { label: "Bens industriais", value: "INDUSTRIALS" },
  { label: "Comunicações", value: "COMMUNICATION" },
  { label: "Consumo cíclico", value: "CONSUMER DISCRETIONARY" },
  { label: "Consumo não cíclico", value: "CONSUMER STAPLES" },
  { label: "Financeiro", value: "FINANCIALS" },
  { label: "Materiais básicos", value: "MATERIALS" },
  { label: "Saúde", value: "HEALTH CARE" },
  { label: "Petróleo, gás e biocombustíveis", value: "RAW ENERGY" },
  { label: "Tecnologia", value: "TECH" },
  { label: "Utilidade Pública", value: "UTILITIES" },
  { label: "Desconhecido", value: "UNKNOWN" },
];

const AssetsTypesMapping = [
  { label: "Ação B3", value: "STOCK" },
  { label: "Ação EUA", value: "STOCK_USA" },
  { label: "Criptoativos", value: "CRYPTO" },
  { label: "Fundo de Investimento Imobiliário", value: "FII" },
];

const TransactionsActionsMapping = [
  { label: "Venda", value: "SELL" },
  { label: "Compra", value: "BUY" },
];

const TransactionCurrenciesMapping = [
  { label: "Real", value: "BRL" },
  { label: "Dólar", value: "USD" },
];

const AccessTokenStr = "accessToken";
const RefreshTokenStr = "refreshToken";

export {
  AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
  BaseApiUrl,
  ExpensesCategoriesMapping,
  ExpensesSourcesMapping,
  AccessTokenStr,
  RefreshTokenStr,
  TransactionsActionsMapping,
  TransactionCurrenciesMapping,
};
