const BaseApiUrl =
  process.env.REACT_APP_BASE_API_URL || "http://127.0.0.1:8000/api/v1";

const AssetsObjectivesMapping = [
  { label: "Crescimento", value: "GROWTH" },
  { label: "Dividendo", value: "DIVIDEND" },
  { label: "Desconhecido", value: "UNKNOWN" },
];

const AssetsSectorsMapping = [
  { label: "Bens industriais", value: "INDUSTRIALS" },
  { label: "Comunicações", value: "COMMUNICATION" },
  { label: "Consumo não cíclico", value: "CONSUMER DISCRETIONARY" },
  { label: "Consumo cíclico", value: "CONSUMER STAPLES" },
  { label: "Financeiro", value: "FINANCIALS" },
  { label: "Materiais básicos", value: "MATERIALS" },
  { label: "Saúde", value: "HEALTH CARE" },
  { label: "Petróleo e derivados", value: "RAW ENERGY" },
  { label: "Tecnologia", value: "TECH" },
  { label: "Utilidade pública", value: "UTILITIES" },
  { label: "Desconhecido", value: "UNKNOWN" },
];

const AssetsTypesMapping = [
  { label: "Ação B3", value: "STOCK" },
  { label: "Ação EUA", value: "STOCK_USA" },
  { label: "Criptoativos", value: "CRYPTO" },
  { label: "FII", value: "FII" },
];

const TransactionsActionsMapping = [
  { label: "Venda", value: "SELL" },
  { label: "Compra", value: "BUY" },
];

const CurrenciesMapping = [
  { label: "Real", value: "BRL" },
  { label: "Dólar", value: "USD" },
];

const CurrenciesAssetTypesMapping = {
  STOCK: "BRL",
  FII: "BRL",
  STOCK_USA: "USD",
};

const PassiveIncomeTypesMapping = [
  { label: "Dividendo", value: "DIVIDEND" },
  { label: "Juros sobre capital próprio", value: "JCP" },
  { label: "Rendimento", value: "INCOME" },
];

const PassiveIncomeEventTypesMapping = [
  { label: "Provisionado", value: "PROVISIONED" },
  { label: "Creditado", value: "CREDITED" },
];

const AccessTokenStr = "accessToken";
const RefreshTokenStr = "refreshToken";

export {
  AccessTokenStr, AssetsObjectivesMapping,
  AssetsSectorsMapping,
  AssetsTypesMapping,
  BaseApiUrl, CurrenciesAssetTypesMapping, CurrenciesMapping, PassiveIncomeEventTypesMapping, PassiveIncomeTypesMapping, RefreshTokenStr,
  TransactionsActionsMapping
};

