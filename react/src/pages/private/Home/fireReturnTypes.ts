export type SamplingMethod =
  | "independent_months"
  | "contiguous_12_month_blocks";
export type UsEquityProxy = "SPY" | "VTI";
export type GlobalEquityProxy = "VT" | "VWRL";
export type CryptoProxy = "BTC" | "CMBI10";

export type ReturnCategory =
  | "BR_EQUITY"
  | "US_EQUITY"
  | "GLOBAL_EQUITY"
  | "FII"
  | "CRYPTO"
  | "FIXED_CDI"
  | "FIXED_SELIC"
  | "FIXED_PREFIXED"
  | "FIXED_IPCA";

export type FireReturnSeriesKey =
  | "IBOV"
  | "IFIX"
  | "SPY"
  | "VTI"
  | "VT"
  | "VWRL"
  | "BTC"
  | "CMBI10"
  | "CDI"
  | "IMA_S"
  | "IRF_M_1"
  | "IRF_M_1_PLUS"
  | "IMA_B_5"
  | "IMA_B_5_PLUS"
  | "IMA_GERAL_EX_C"
  | "CASH";
