export type OneOverNTrialInput = {
  startingBalance: number;
  years: number;
  monthlyReturns: readonly number[];
};
export type OneOverNTrial = {
  balances: number[];
  annualWithdrawals: number[];
  monthlyPayments: number[];
  minimumMonthlyIncome: number;
};

/** Annual 1/N withdrawal, consumed monthly. The committed annual allowance
 * leaves the invested portfolio; only the remainder earns portfolio returns. */
export const traceOneOverNTrial = (
  input: OneOverNTrialInput,
): OneOverNTrial => {
  const { startingBalance, years, monthlyReturns } = input;
  if (
    !Number.isFinite(startingBalance) ||
    startingBalance < 0 ||
    !Number.isSafeInteger(years) ||
    years <= 0 ||
    monthlyReturns.length !== years * 12 ||
    monthlyReturns.some((r) => !Number.isFinite(r) || r < -1)
  ) {
    throw new Error("Informe valores e prazo válidos para a retirada 1/N.");
  }
  let balance = startingBalance;
  const balances = [balance],
    annualWithdrawals: number[] = [],
    monthlyPayments: number[] = [];
  for (let year = 0; year < years; year++) {
    const allowance = balance / (years - year);
    annualWithdrawals.push(allowance);
    balance = Math.max(0, balance - allowance);
    let remaining = allowance;
    for (let month = 0; month < 12; month++) {
      const payment = month === 11 ? remaining : allowance / 12;
      monthlyPayments.push(payment);
      remaining -= payment;
      balance *= 1 + monthlyReturns[year * 12 + month];
    }
    balances.push(balance);
  }
  return {
    balances,
    annualWithdrawals,
    monthlyPayments,
    minimumMonthlyIncome: Math.min(...annualWithdrawals) / 12,
  };
};
