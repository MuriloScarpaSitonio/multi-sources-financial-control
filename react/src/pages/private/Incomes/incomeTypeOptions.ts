import { TypesMapping } from "./consts";

const FIXED_BR_TYPES = new Set(["FIXED_BR", "Renda fixa BR"]);
const INTEREST = "INTEREST";

export const incomeTypeOptionsForAssetType = (assetType?: string) =>
  Object.entries(TypesMapping)
    .map(([label, { value }]) => ({ label, value }))
    .filter(({ value }) =>
      assetType && FIXED_BR_TYPES.has(assetType)
        ? value === INTEREST
        : value !== INTEREST,
    );
