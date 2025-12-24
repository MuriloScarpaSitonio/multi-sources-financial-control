import { useMemo } from "react";

import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import { Cell, Pie, PieChart as PieReChart, ResponsiveContainer } from "recharts";

import { startOfMonth, subDays } from "date-fns";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useBankAccount } from "../Expenses/hooks";
import { useAssetsIndicators } from "../Assets/Indicators/hooks";
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { customEndOfMonth } from "../utils";
import { useHomeRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import { useIncomesSumCredited, useIncomesIndicators } from "../Incomes/Indicators/hooks";
import { IndicatorBox } from "../Expenses/Indicators/components";
import { useHideValues } from "../../../hooks/useHideValues";

type FinancialHealthIndicatorsProps = {
  revenues: number;
  expenses: number;
  avgExpenses: number;
  avgPassiveIncome: number;
  bankAmount: number;
  investmentsTotal: number;
  patrimonyTotal: number;
  passiveIncomes90Days: number;
  futureExpenses: number;
  futureRevenues: number;
  isLoading: boolean;
  isFutureExpensesLoading: boolean;
  isPassiveIncomeLoading: boolean;
};

const formatCurrency = (value: number) =>
  `R$ ${Math.abs(value).toLocaleString("pt-br", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PatrimonyCompositionIndicator = ({
  investmentsPercentage,
  bankPercentage,
  isLoading,
}: {
  investmentsPercentage: number;
  bankPercentage: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const pieData = useMemo(
    () => [
      { name: "Investimentos", value: investmentsPercentage },
      { name: "Conta corrente", value: bankPercentage },
    ],
    [investmentsPercentage, bankPercentage],
  );

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  return (
    <Tooltip
      title="Distribuição do patrimônio entre investimentos e conta corrente"
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox variant="success" width="100%">
          <Stack gap={0.5} sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Composição patrimonial
              </Text>
              <Stack direction="row" alignItems="center" gap={1}>
                <div style={{ width: 60, height: 60 }}>
                  {hideValues ? (
                    <Skeleton
                      variant="circular"
                      width={60}
                      height={60}
                      sx={{ bgcolor: getColor(Colors.neutral300) }}
                      animation={false}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieReChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={15}
                          outerRadius={28}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                index === 0
                                  ? getColor(Colors.brand400)
                                  : getColor(Colors.brand200)
                              }
                            />
                          ))}
                        </Pie>
                      </PieReChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <Stack gap={0.5}>
                  {pieData.map((entry, index) => (
                    <Stack
                      key={entry.name}
                      direction="row"
                      alignItems="center"
                      gap={0.5}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor:
                            index === 0
                              ? getColor(Colors.brand400)
                              : getColor(Colors.brand200),
                        }}
                      />
                      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
                        {entry.name}
                      </Text>
                      {hideValues ? (
                        <Skeleton
                          sx={{
                            bgcolor: getColor(Colors.neutral300),
                            width: "30px",
                            display: "inline-block",
                          }}
                          animation={false}
                        />
                      ) : (
                        <Text
                          size={FontSizes.EXTRA_SMALL}
                          weight={FontWeights.BOLD}
                          color={Colors.neutral0}
                        >
                          {entry.value.toFixed(0)}%
                        </Text>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const EmergencyFundLinearProgress = styled(LinearProgress)<{ isHealthy?: boolean }>(
  ({ isHealthy }) => ({
    height: 6,
    borderRadius: 3,
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: getColor(Colors.neutral600),
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: 3,
      backgroundColor: isHealthy
        ? getColor(Colors.brand)
        : getColor(Colors.danger200),
    },
  }),
);

const EmergencyFundIndicator = ({
  monthsCovered,
  targetMonths,
  avgExpenses,
  isLoading,
}: {
  monthsCovered: number;
  targetMonths: number;
  avgExpenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const progress = Math.min((monthsCovered / targetMonths) * 100, 100);
  const isHealthy = monthsCovered >= targetMonths;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Saldo em conta / média mensal de despesas (dos últimos 12 meses: ${avgExpensesFormatted}).`;

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox
          variant={isHealthy ? "success" : "danger"}
          width="100%"
        >
          <Stack gap={0.5} sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Reserva de emergência
              </Text>
              <Stack direction="row" alignItems="baseline" gap={0.5}>
                {hideValues ? (
                  <Skeleton
                    sx={{
                      bgcolor: getColor(Colors.neutral300),
                      width: "60px",
                      display: "inline-block",
                    }}
                    animation={false}
                  />
                ) : (
                  <Text
                    size={FontSizes.SMALL}
                    weight={FontWeights.BOLD}
                    color={Colors.neutral0}
                  >
                    {monthsCovered.toFixed(1)} meses
                  </Text>
                )}
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  de {targetMonths} meses (meta)
                </Text>
              </Stack>
            </Stack>
            <EmergencyFundLinearProgress
              variant="determinate"
              value={Math.min(progress, 100)}
              isHealthy={isHealthy}
            />
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const FutureExpensesIndicator = ({
  value,
  bankAmount,
  futureRevenues,
  isLoading,
}: {
  value: number;
  bankAmount: number;
  futureRevenues: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const availableFunds = bankAmount + futureRevenues;
  const canCoverFutureExpenses = availableFunds >= value;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  const bankAmountFormatted = hideValues ? "***" : formatCurrency(bankAmount);
  const futureRevenuesFormatted = hideValues ? "***" : formatCurrency(futureRevenues);
  const availableFundsFormatted = hideValues ? "***" : formatCurrency(availableFunds);
  const tooltipTitle = canCoverFutureExpenses
    ? `Suas despesas futuras estão cobertas. Saldo em conta (${bankAmountFormatted}) + receitas futuras (${futureRevenuesFormatted}) = ${availableFundsFormatted}`
    : `Suas despesas futuras excedem seus recursos disponíveis. Saldo em conta (${bankAmountFormatted}) + receitas futuras (${futureRevenuesFormatted}) = ${availableFundsFormatted}`;

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox variant={canCoverFutureExpenses ? "success" : "danger"} width="100%">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: "100%" }}
          >
            <Text size={FontSizes.SMALL} color={Colors.neutral300}>
              Despesas futuras
            </Text>
            <Stack direction="row" alignItems="baseline" gap={0.5}>
              {hideValues ? (
                <Skeleton
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "80px",
                    display: "inline-block",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  size={FontSizes.SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral0}
                >
                  {formatCurrency(value)}
                </Text>
              )}
            </Stack>
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const PassiveIncomeCoverageLinearProgress = styled(LinearProgress)<{ percentage: number }>(
  ({ percentage }) => ({
    height: 6,
    borderRadius: 3,
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: getColor(Colors.neutral600),
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: 3,
      backgroundColor: percentage >= 100
        ? getColor(Colors.brand)
        : getColor(Colors.danger200),
    },
  }),
);

const PassiveIncomeCoverageIndicator = ({
  avgPassiveIncome,
  avgExpenses,
  isLoading,
}: {
  avgPassiveIncome: number;
  avgExpenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const coveragePercentage = avgExpenses > 0 ? (avgPassiveIncome / avgExpenses) * 100 : 0;
  const isFullyCovered = coveragePercentage >= 100;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  const avgPassiveIncomeFormatted = hideValues ? "***" : formatCurrency(avgPassiveIncome);
  const avgExpensesFormatted = hideValues ? "***" : formatCurrency(avgExpenses);
  const tooltipTitle = `Média mensal de proventos (${avgPassiveIncomeFormatted}) / média mensal de despesas (${avgExpensesFormatted}) dos últimos 12 meses. Meta: 100% para independência financeira.`;

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox
          variant={isFullyCovered ? "success" : "danger"}
          width="100%"
        >
          <Stack gap={0.5} sx={{ width: "100%" }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Cobertura de proventos
              </Text>
              <Stack direction="row" alignItems="baseline" gap={0.5}>
                {hideValues ? (
                  <Skeleton
                    sx={{
                      bgcolor: getColor(Colors.neutral300),
                      width: "60px",
                      display: "inline-block",
                    }}
                    animation={false}
                  />
                ) : (
                  <Text
                    size={FontSizes.SMALL}
                    weight={FontWeights.BOLD}
                    color={Colors.neutral0}
                  >
                    {coveragePercentage.toFixed(1)}%
                  </Text>
                )}
                <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                  das despesas
                </Text>
              </Stack>
            </Stack>
            <PassiveIncomeCoverageLinearProgress
              variant="determinate"
              value={Math.min(coveragePercentage, 100)}
              percentage={coveragePercentage}
            />
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const FinancialHealthIndicators = ({
  revenues,
  expenses,
  avgExpenses,
  avgPassiveIncome,
  bankAmount,
  investmentsTotal,
  patrimonyTotal,
  passiveIncomes90Days,
  futureExpenses,
  futureRevenues,
  isLoading,
  isFutureExpensesLoading,
  isPassiveIncomeLoading,
}: FinancialHealthIndicatorsProps) => {
  const { hideValues } = useHideValues();

  // Patrimony composition
  const investmentsPercentage = patrimonyTotal > 0 ? (investmentsTotal / patrimonyTotal) * 100 : 0;
  const bankPercentage = patrimonyTotal > 0 ? (bankAmount / patrimonyTotal) * 100 : 0;

  // Monthly balance
  const monthlyBalance = revenues - expenses;
  const isBalancePositive = monthlyBalance >= 0;

  // Emergency fund
  const monthsCovered = avgExpenses > 0 ? bankAmount / avgExpenses : 0;
  const emergencyFundTarget = 6;

  const indicators = useMemo(
    () => [
      {
        label: "Proventos (90 dias)",
        tooltip: "Soma de proventos de renda variável creditados nos últimos 90 dias",
        value: hideValues ? null : formatCurrency(passiveIncomes90Days),
        variant: passiveIncomes90Days > 0 ? "success" : "danger",
      },
      {
        label: "Balanço mensal",
        tooltip: "Receitas menos despesas do mês atual",
        value: hideValues ? null : formatCurrency(monthlyBalance),
        variant: isBalancePositive ? "success" : "danger",
      },
    ],
    [
      hideValues,
      passiveIncomes90Days,
      monthlyBalance,
      isBalancePositive
    ],
  );

  if (isLoading) {
    return (
      <Stack gap={1.5}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width="100%" height={56} sx={{ borderRadius: "10px" }} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} sx={{ mt: 2, mb: 2 }}>
      <PatrimonyCompositionIndicator
        investmentsPercentage={investmentsPercentage}
        bankPercentage={bankPercentage}
        isLoading={isLoading}
      />
      {indicators.map((indicator) => (
        <Tooltip key={indicator.label} title={indicator.tooltip} arrow placement="top">
          <div>
            <IndicatorBox
              variant={indicator.variant as "success" | "danger"}
              width="100%"
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ width: "100%" }}
              >
                <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                  {indicator.label}
                </Text>
                <Stack direction="row" alignItems="baseline" gap={0.5}>
                  {indicator.value ? (
                    <Text
                      size={FontSizes.SMALL}
                      weight={FontWeights.BOLD}
                      color={Colors.neutral0}
                    >
                      {indicator.value}
                    </Text>
                  ) : (
                    <Skeleton
                      sx={{
                        bgcolor: getColor(Colors.neutral300),
                        width: "60px",
                        display: "inline-block",
                      }}
                      animation={false}
                    />
                  )}
                </Stack>
              </Stack>
            </IndicatorBox>
          </div>
        </Tooltip>
      ))}
      <EmergencyFundIndicator
        monthsCovered={monthsCovered}
        targetMonths={emergencyFundTarget}
        avgExpenses={avgExpenses}
        isLoading={isLoading}
      />
      <PassiveIncomeCoverageIndicator
        avgPassiveIncome={avgPassiveIncome}
        avgExpenses={avgExpenses}
        isLoading={isPassiveIncomeLoading}
      />
      <FutureExpensesIndicator
        value={futureExpenses}
        bankAmount={bankAmount}
        futureRevenues={futureRevenues}
        isLoading={isFutureExpensesLoading}
      />
    </Stack>
  );
};

export const FinancialHealthSummary = () => {
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: customEndOfMonth(now),
    };
  }, []);

  const { startDate: incomes90DaysStart, endDate: incomes90DaysEnd } = useMemo(() => {
    const now = new Date();
    return {
      startDate: subDays(now, 90),
      endDate: now,
    };
  }, []);

  const {
    data: assetsIndicators,
    isPending: isAssetsIndicatorsLoading,
  } = useAssetsIndicators();

  const {
    data: { amount: bankAmount } = { amount: 0 },
    isPending: isBankAccountLoading,
  } = useBankAccount();

  const {
    data: expensesIndicators,
    isPending: isExpensesIndicatorsLoading,
  } = useHomeExpensesIndicators();

  const {
    data: revenuesIndicators,
    isPending: isRevenuesIndicatorsLoading,
  } = useHomeRevenuesIndicators();

  const { data: { total: passiveIncomes90Days } = { total: 0 }, isPending: isIncomesLoading } =
    useIncomesSumCredited({ startDate: incomes90DaysStart, endDate: incomes90DaysEnd });

  const {
    data: incomesIndicators,
    isPending: isIncomesIndicatorsLoading,
  } = useIncomesIndicators({ startDate, endDate });

  const isLoading =
    isAssetsIndicatorsLoading ||
    isBankAccountLoading ||
    isExpensesIndicatorsLoading ||
    isRevenuesIndicatorsLoading ||
    isIncomesLoading;

  return (
    <FinancialHealthIndicators
      revenues={revenuesIndicators?.total ?? 0}
      expenses={expensesIndicators?.total ?? 0}
      avgExpenses={expensesIndicators?.avg ?? 0}
      avgPassiveIncome={incomesIndicators?.avg ?? 0}
      bankAmount={bankAmount}
      investmentsTotal={assetsIndicators?.total ?? 0}
      patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
      passiveIncomes90Days={passiveIncomes90Days}
      futureExpenses={expensesIndicators?.future ?? 0}
      futureRevenues={revenuesIndicators?.future ?? 0}
      isLoading={isLoading}
      isFutureExpensesLoading={isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading}
      isPassiveIncomeLoading={isIncomesIndicatorsLoading}
    />
  );
};
