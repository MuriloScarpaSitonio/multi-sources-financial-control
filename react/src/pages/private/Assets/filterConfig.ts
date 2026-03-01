import type { FilterFieldConfigs } from "../../../components/FilterIndicators";

const typesValueMapping: Record<string, string> = {
  STOCK: "Ação BR",
  STOCK_USA: "Ação EUA",
  CRYPTO: "Cripto",
  FII: "FII",
  FIXED_BR: "Renda fixa BR",
};

const sectorsValueMapping: Record<string, string> = {
  INDUSTRIALS: "Bens industriais",
  COMMUNICATION: "Comunicações",
  "CONSUMER DISCRETIONARY": "Consumo não cíclico",
  "CONSUMER STAPLES": "Consumo cíclico",
  FINANCIALS: "Financeiro",
  MATERIALS: "Materiais básicos",
  "HEALTH CARE": "Saúde",
  "RAW ENERGY": "Petróleo e derivados",
  TECH: "Tecnologia",
  UTILITIES: "Utilidade pública",
  UNKNOWN: "Desconhecido",
};

const objectivesValueMapping: Record<string, string> = {
  GROWTH: "Crescimento",
  DIVIDEND: "Dividendo",
  UNKNOWN: "Desconhecido",
};

const statusValueMapping: Record<string, string> = {
  OPENED: "Aberto",
  CLOSED: "Fechado",
};

export const assetsFilterConfig: FilterFieldConfigs = {
  type: {
    label: "Categoria",
    valueMapping: typesValueMapping,
  },
  sector: {
    label: "Setor",
    valueMapping: sectorsValueMapping,
  },
  objective: {
    label: "Objetivo",
    valueMapping: objectivesValueMapping,
  },
  status: {
    label: "Status",
    valueMapping: statusValueMapping,
  },
  emergency_fund: {
    label: "Reserva de emergência",
    valueMapping: {
      true: "Sim",
      false: "Não",
    },
  },
};

export const defaultAssetsFilters = {
  status: "OPENED",
};
