export const AssetsTypesMapping = {
  "Ação B3": { value: "STOCK", color: "#cc6cc8", display: "Ação BR" },
  "Ação EUA": { value: "STOCK_USA", color: "#906ccc" },
  Criptoativos: { value: "CRYPTO", color: "#ccc86c", display: "Cripto" },
  "Fundo de Investimento Imobiliário": {
    value: "FII",
    color: "#6cccc6",
    display: "FII",
  },
};

export const AssetsObjectivesMapping = {
  Crescimento: { value: "GROWTH", color: "#cc6cc8" },
  Dividendo: { value: "DIVIDEND", color: "#ccc86c" },
  Desconhecido: { value: "UNKNOWN", color: "#d9d3c5" },
};

export const AssetsSectorsMapping = {
  "Bens industriais": { value: "INDUSTRIALS", color: "#906ccc" },
  Comunicações: { value: "COMMUNICATION", color: "#ccc86c" },
  "Consumo não cíclico": { value: "CONSUMER DISCRETIONARY", color: "#cc6cc8" },
  "Consumo cíclico": { value: "CONSUMER STAPLES", color: "#6cccc6" },
  Financeiro: { value: "FINANCIALS", color: "#e6837c" },
  "Materiais básicos": { value: "MATERIALS", color: "#729e81" },
  Saúde: { value: "HEALTH CARE", color: "#d9a648" },
  "Petróleo, gás e biocombustíveis": { value: "RAW ENERGY", color: "#818deb" },
  Tecnologia: { value: "TECH", color: "#c9b671" },
  "Utilidade pública": { value: "UTILITIES", color: "#d984cc" },
  Desconhecido: { value: "UNKNOWN", color: "#d9d3c5" },
};

export const AssetOptionsProperties: {
  [key: string]: { value: string; color: string; display?: string };
} = {
  ...AssetsTypesMapping,
  ...AssetsObjectivesMapping,
  ...AssetsSectorsMapping,
};
