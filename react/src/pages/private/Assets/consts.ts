export const AssetsTypesMapping: Record<
  string,
  { value: string; color: string }
> = {
  "Ação BR": { value: "STOCK", color: "#cc6cc8" },
  "Ação EUA": { value: "STOCK_USA", color: "#906ccc" },
  Cripto: { value: "CRYPTO", color: "#ccc86c" },
  FII: { value: "FII", color: "#6cccc6" },
};

export const AssetsObjectivesMapping = {
  Crescimento: { value: "GROWTH", color: "#cc6cc8" },
  Dividendo: { value: "DIVIDEND", color: "#ccc86c" },
  Desconhecido: { value: "UNKNOWN", color: "#d9d3c5" },
};

export const AssetsObjectivesValueToLabelMapping = {
  GROWTH: "Crescimento",
  DIVIDEND: "Dividendo",
  UNKNOWN: "Desconhecido",
};

export const AssetsSectorsMapping = {
  "Bens industriais": { value: "INDUSTRIALS", color: "#906ccc" },
  Comunicações: { value: "COMMUNICATION", color: "#ccc86c" },
  "Consumo não cíclico": { value: "CONSUMER DISCRETIONARY", color: "#cc6cc8" },
  "Consumo cíclico": { value: "CONSUMER STAPLES", color: "#6cccc6" },
  Financeiro: { value: "FINANCIALS", color: "#e6837c" },
  "Materiais básicos": { value: "MATERIALS", color: "#729e81" },
  Saúde: { value: "HEALTH CARE", color: "#d9a648" },
  "Petróleo e derivados": { value: "RAW ENERGY", color: "#818deb" },
  Tecnologia: { value: "TECH", color: "#c9b671" },
  "Utilidade pública": { value: "UTILITIES", color: "#d984cc" },
  Desconhecido: { value: "UNKNOWN", color: "#d9d3c5" },
};

export const AssetOptionsProperties: {
  [key: string]: { value: string; color: string };
} = {
  ...AssetsTypesMapping,
  ...AssetsObjectivesMapping,
  ...AssetsSectorsMapping,
};

export enum AssetCurrencies {
  BRL = "BRL",
  USD = "USD",
}

export const AssetCurrencyMap = {
  [AssetCurrencies.BRL]: { label: "Real", symbol: "R$" },
  [AssetCurrencies.USD]: { label: "Dólar", symbol: "US$" },
};

export const AssetsIncomeTypesMapping = {
  Rendimento: { value: "INCOME", color: "#cc6cc8" },
  Dividendo: { value: "DIVIDEND", color: "#ccc86c" },
  Reembolso: { value: "REIMBURSEMENT", color: "#7eccb7" },
  "Juros sobre capital próprios": { value: "JCP", color: "#d9d3c5" },
};

export enum AssetIncomeEventTypes {
  CREDITED = "CREDITED",
  PROVISIONED = "PROVISIONED",
}
