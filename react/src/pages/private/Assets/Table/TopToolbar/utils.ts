import { AssetCurrencies, AssetsTypesMapping } from "../../consts";

export const hasSelectableCurrency = (type?: string): boolean =>
  type === "CRYPTO" || type === "EQUITY_GLOBAL";

export const getCurrencyFromType = (
  type: keyof typeof AssetsTypesMapping,
  selectedCurrency?: string,
): AssetCurrencies => {
  if (
    hasSelectableCurrency(type) &&
    (selectedCurrency === AssetCurrencies.BRL ||
      selectedCurrency === AssetCurrencies.USD)
  )
    return selectedCurrency;
  if (["STOCK", "FII"].includes(type)) return AssetCurrencies.BRL;
  if (type === "STOCK_USA" || type === "EQUITY_GLOBAL")
    return AssetCurrencies.USD;
  return AssetCurrencies.BRL;
};
