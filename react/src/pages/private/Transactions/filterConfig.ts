import type { FilterFieldConfigs } from "../../../components/FilterIndicators";
import type { FilterSchema } from "../../../urlParams";

const assetTypesValueMapping: Record<string, string> = {
  STOCK: "Ação BR",
  STOCK_USA: "Ação EUA",
  CRYPTO: "Cripto",
  FII: "FII",
  FIXED_BR: "Renda fixa BR",
};

const actionValueMapping: Record<string, string> = {
  BUY: "Compra",
  SELL: "Venda",
};

export const transactionsFilterConfig: FilterFieldConfigs = {
  asset_type: {
    label: "Categoria do ativo",
    valueMapping: assetTypesValueMapping,
  },
  action: {
    label: "Negociação",
    valueMapping: actionValueMapping,
  },
};

export const transactionsFilterSchema: FilterSchema = {
  asset_type: { type: "array" },
  action: { type: "string" },
};
