import { AssetCurrencies, AssetsTypesMapping } from "../../consts";

export const getCurrencyFromType = (
  type: keyof typeof AssetsTypesMapping,
): AssetCurrencies => {
  if (["STOCK", "FII"].includes(type)) return AssetCurrencies.BRL;
  if (type === "STOCK_USA" || type === "EQUITY_GLOBAL") return AssetCurrencies.USD;
  return AssetCurrencies.BRL;
};
