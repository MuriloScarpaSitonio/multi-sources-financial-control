import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { useHomeRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";

/**
 * Queries every strategy detail page needs: trailing-month expense average
 * (for the FIRE-style retirement math) and revenues average (paired with
 * expenses to derive monthly savings). Strategy-specific data (assets reports,
 * passive income, bank balances) stays with the strategy that uses it.
 */
export const useStrategyCommonData = () => {
  const {
    data: expensesIndicators,
    isPending: isExpensesLoading,
    isError: isExpensesError,
    refetch: retryExpenses,
  } = useHomeExpensesIndicators({ includeFireAvg: true });
  const {
    data: revenuesIndicators,
    isPending: isRevenuesLoading,
    isError: isRevenuesError,
    refetch: retryRevenues,
  } = useHomeRevenuesIndicators();

  const avgExpenses = expensesIndicators?.fire_avg ?? 0;
  const expensesAvg = expensesIndicators?.avg ?? 0;
  const avgRevenues = revenuesIndicators?.avg ?? 0;
  const derivedMonthlySavings = avgRevenues - expensesAvg;

  const hasRequiredData = Boolean(
    expensesIndicators &&
    revenuesIndicators &&
    [
      expensesIndicators.fire_avg,
      expensesIndicators.avg,
      revenuesIndicators.avg,
    ].every((value) => typeof value === "number" && Number.isFinite(value)),
  );
  return {
    hasRequiredData,
    retry: () => Promise.allSettled([retryExpenses(), retryRevenues()]),
    avgExpenses,
    expensesAvg,
    avgRevenues,
    derivedMonthlySavings,
    isLoading: isExpensesLoading || isRevenuesLoading,
    isError: isExpensesError || isRevenuesError,
  };
};
