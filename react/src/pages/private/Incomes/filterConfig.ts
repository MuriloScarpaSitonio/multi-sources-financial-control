import type { FilterFieldConfigs } from "../../../components/FilterIndicators";

const assetTypesValueMapping: Record<string, string> = {
  STOCK: "Ação BR",
  STOCK_USA: "Ação EUA",
  CRYPTO: "Cripto",
  FII: "FII",
  FIXED_BR: "Renda fixa BR",
};

const typesValueMapping: Record<string, string> = {
  INCOME: "Rendimento",
  DIVIDEND: "Dividendo",
  REIMBURSEMENT: "Reembolso",
  JCP: "Juros sobre capital próprios",
};

const eventTypesValueMapping: Record<string, string> = {
  CREDITED: "Creditado",
  PROVISIONED: "Provisionado",
};

export const incomesFilterConfig: FilterFieldConfigs = {
  asset_type: {
    label: "Categoria do ativo",
    valueMapping: assetTypesValueMapping,
  },
  type: {
    label: "Categoria",
    valueMapping: typesValueMapping,
  },
  event_type: {
    label: "Evento",
    valueMapping: eventTypesValueMapping,
  },
};
