import { Colors, getColor } from "../../../design-system";

export const sliderSx = {
  width: 100,
  "& .MuiSlider-thumb": {
    width: 14,
    height: 14,
    backgroundColor: getColor(Colors.brand500),
    "&:hover, &.Mui-focusVisible": {
      boxShadow: `0 0 0 8px ${getColor(Colors.brand500)}33`,
    },
  },
  "& .MuiSlider-track": {
    backgroundColor: getColor(Colors.brand500),
    border: "none",
  },
  "& .MuiSlider-rail": {
    backgroundColor: getColor(Colors.brand500),
  },
};

// Hand-maintained reference for dividend-focused portfolios in the BR market.
// Numbers are 10-year historical averages of B3 indices, sourced from Economatica:
// https://insight.economatica.com/dividend-yield-medio-dos-indices/
// (IDIV = top dividend stocks; IFIX = real-estate funds.)
// Revisit annually — re-fetch the article or successor publication.
// Last reviewed: 2026-04.
export const TYPICAL_DIVIDEND_YIELD = {
  rangeMin: 6,
  rangeMax: 10,
  idiv: 7,
  ifix: 8,
};

// Trailing-12-month IPCA reference, used to deflate the YoY income trend in
// the dividends-only diagnostics. Hardcoded — revisit annually against
// BCB SGS series 433 (https://api.bcb.gov.br/dados/serie/bcdata.sgs.433).
// Last reviewed: 2026-05.
export const TYPICAL_TRAILING_IPCA_PCT = 4.5;
