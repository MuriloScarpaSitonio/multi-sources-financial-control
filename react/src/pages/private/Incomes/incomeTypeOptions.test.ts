import { incomeTypeOptionsForAssetType } from "./incomeTypeOptions";

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

assertEqual(
  incomeTypeOptionsForAssetType("FIXED_BR").map(({ value }) => value).join(","),
  "INTEREST",
  "fixed-income assets only offer interest",
);
assertEqual(
  incomeTypeOptionsForAssetType("Renda fixa BR")
    .map(({ value }) => value)
    .join(","),
  "INTEREST",
  "existing fixed-income entries only offer interest when edited",
);
assertEqual(
  incomeTypeOptionsForAssetType("STOCK").some(({ value }) => value === "INTEREST"),
  false,
  "non-fixed-income assets do not offer interest",
);

// eslint-disable-next-line no-console
console.log("incomeTypeOptions.test.ts passed");
