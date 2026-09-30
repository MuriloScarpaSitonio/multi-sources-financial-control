const validateMonths = (months: number): void => {
  if (!Number.isSafeInteger(months) || months <= 0) {
    throw new Error("Remaining months must be a positive integer");
  }
};

const monthlyLogGrowth = (annualGrowth: number): number => {
  if (!Number.isFinite(annualGrowth) || annualGrowth <= -1) {
    throw new Error("Annual growth must be finite and greater than -100%");
  }
  return Math.log1p(annualGrowth) / 12;
};

// Present value of beginning-of-month payments: the first payment earns no
// return. log1p/expm1 preserve precision for assumptions close to zero growth.
const rateForMonths = (logGrowth: number, months: number): number => {
  if (months === 1) return 1;
  if (logGrowth === 0) return 1 / months;
  return -Math.expm1(-logGrowth) / -Math.expm1(-months * logGrowth);
};

export const vpwMonthlyRate = (
  annualGrowth: number,
  monthsRemaining: number,
): number => {
  validateMonths(monthsRemaining);
  return rateForMonths(monthlyLogGrowth(annualGrowth), monthsRemaining);
};

// Compute once per request, never inside a trial's month loop.
export const vpwMonthlyRates = (
  annualGrowth: number,
  totalMonths: number,
): Float64Array => {
  validateMonths(totalMonths);
  const logGrowth = monthlyLogGrowth(annualGrowth);
  return Float64Array.from({ length: totalMonths }, (_, month) =>
    rateForMonths(logGrowth, totalMonths - month),
  );
};

// Capital for the initial withdrawal only. Retirement planning targets use
// findVPWTargets and its 95% full-horizon coverage criterion.
export const vpwTarget = (
  monthlySpending: number,
  annualGrowth: number,
  monthsRemaining: number,
): number => {
  if (!Number.isFinite(monthlySpending) || monthlySpending < 0) {
    throw new Error("Monthly spending must be finite and nonnegative");
  }
  return monthlySpending / vpwMonthlyRate(annualGrowth, monthsRemaining);
};
