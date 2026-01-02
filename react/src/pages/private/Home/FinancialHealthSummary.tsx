import { useMemo, useState } from "react";

import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
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
import { useBankAccount, usePatrimonyGrowth } from "../Expenses/hooks";
import { useAssetsIndicators, useEmergencyFundAssets } from "../Assets/Indicators/hooks";
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { customEndOfMonth, formatCurrency } from "../utils";
import { useHomeRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import { useIncomesSumCredited, useIncomesIndicators } from "../Incomes/Indicators/hooks";
import { IndicatorBox } from "../Expenses/Indicators/components";
import { useHideValues } from "../../../hooks/useHideValues";
import { EmergencyFundIndicator } from "../Expenses/Indicators/EmergencyFundIndicator";
import { FutureExpensesIndicator } from "../Expenses/Indicators/FutureExpensesIndicator";
import { PassiveIncomeCoverageIndicator } from "../Expenses/Indicators/PassiveIncomeCoverageIndicator";

type FinancialHealthIndicatorsProps = {
  avgExpenses: number;
  avgPassiveIncome: number;
  bankAmount: number;
  liquidAssetsTotal: number;
  investmentsTotal: number;
  patrimonyTotal: number;
  passiveIncomes90Days: number;
  futureExpenses: number;
  futureRevenues: number;
  yieldOnCost: number;
  isLoading: boolean;
  isFutureExpensesLoading: boolean;
  isPassiveIncomeLoading: boolean;
  isEmergencyFundLoading: boolean;
};

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
                          {entry.value.toFixed(2)}%
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


const DividendYieldIndicator = ({
  yieldOnCost,
  isLoading,
}: {
  yieldOnCost: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const isGoodYield = yieldOnCost >= 6;

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  if (yieldOnCost === 0) {
    return null;
  }

  const tooltipTitle = "Rendimento de proventos sobre o custo total investido (posições abertas). Acima de 6% é considerado bom.";

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox
          variant={isGoodYield ? "success" : "danger"}
          width="100%"
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: "100%" }}
          >
            <Text size={FontSizes.SMALL} color={Colors.neutral300}>
              Yield on Cost
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
                  {yieldOnCost.toFixed(2)}%
                </Text>
              )}
            </Stack>
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const GrowthSelect = styled(Select)({
  "& .MuiSelect-select": {
    padding: "2px 8px",
    fontSize: "12px",
    color: getColor(Colors.neutral0),
    backgroundColor: getColor(Colors.neutral700),
    borderRadius: "4px",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    border: "none",
  },
  "& .MuiSvgIcon-root": {
    color: getColor(Colors.neutral300),
    fontSize: "16px",
  },
});

const NetWorthGrowthIndicator = () => {
  const { hideValues } = useHideValues();
  const [months, setMonths] = useState<number>(0);
  const [years, setYears] = useState<number>(1);

  const { data: growthData, isPending: isLoading } = usePatrimonyGrowth({
    months: months || undefined,
    years: years || undefined,
  });

  const formatGrowth = (value: number | null) => {
    if (value === null) return "—";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const growthPercentage = growthData?.growth_percentage ?? null;
  const isPositive = (growthPercentage ?? 0) >= 0;

  const historicalTotalFormatted = hideValues ? "***" : formatCurrency(growthData?.historical_total ?? 0);
  const currentTotalFormatted = hideValues ? "***" : formatCurrency(growthData?.current_total ?? 0);
  const tooltipTitle = growthData?.historical_date
    ? `Crescimento patrimonial desde ${new Date(growthData.historical_date).toLocaleDateString("pt-BR")}. Na época você tinha ${historicalTotalFormatted}, hoje tem ${currentTotalFormatted}`
    : "Sem dados históricos para o período selecionado";

  if (isLoading) {
    return (
      <Skeleton width="100%" height={56} sx={{ borderRadius: "10px" }} />
    );
  }

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <div>
        <IndicatorBox
          variant={isPositive ? "success" : "danger"}
          width="100%"
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: "100%" }}
          >
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Variação patrimonial
              </Text>
              <GrowthSelect
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                size="small"
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: getColor(Colors.neutral800) },
                  },
                }}
              >
                <MenuItem value={0}>-</MenuItem>
                <MenuItem value={1}>1a</MenuItem>
                <MenuItem value={2}>2a</MenuItem>
                <MenuItem value={3}>3a</MenuItem>
                <MenuItem value={5}>5a</MenuItem>
              </GrowthSelect>
              <GrowthSelect
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                size="small"
                MenuProps={{
                  PaperProps: {
                    sx: { bgcolor: getColor(Colors.neutral800) },
                  },
                }}
              >
                <MenuItem value={0}>-</MenuItem>
                <MenuItem value={3}>3m</MenuItem>
                <MenuItem value={6}>6m</MenuItem>
                <MenuItem value={9}>9m</MenuItem>
              </GrowthSelect>
            </Stack>
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
              >
                {formatGrowth(growthPercentage)}
              </Text>
            )}
          </Stack>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};


const FinancialHealthIndicators = ({
  avgExpenses,
  avgPassiveIncome,
  bankAmount,
  liquidAssetsTotal,
  investmentsTotal,
  patrimonyTotal,
  passiveIncomes90Days,
  futureExpenses,
  futureRevenues,
  yieldOnCost,
  isLoading,
  isFutureExpensesLoading,
  isPassiveIncomeLoading,
  isEmergencyFundLoading,
}: FinancialHealthIndicatorsProps) => {
  const { hideValues } = useHideValues();

  // Patrimony composition
  const investmentsPercentage = patrimonyTotal > 0 ? (investmentsTotal / patrimonyTotal) * 100 : 0;
  const bankPercentage = patrimonyTotal > 0 ? (bankAmount / patrimonyTotal) * 100 : 0;

  // Emergency fund
  const totalEmergencyFund = bankAmount + liquidAssetsTotal;
  const monthsCovered = avgExpenses > 0 ? totalEmergencyFund / avgExpenses : 0;

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
      <Tooltip title="Soma de proventos de renda variável creditados nos últimos 90 dias" arrow placement="top">
        <div>
          <IndicatorBox
            variant={passiveIncomes90Days > 0 ? "success" : "danger"}
            width="100%"
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ width: "100%" }}
            >
              <Text size={FontSizes.SMALL} color={Colors.neutral300}>
                Proventos (90 dias)
              </Text>
              <Stack direction="row" alignItems="baseline" gap={0.5}>
                {!hideValues ? (
                  <Text
                    size={FontSizes.SMALL}
                    weight={FontWeights.BOLD}
                    color={Colors.neutral0}
                  >
                    {hideValues ? null : formatCurrency(passiveIncomes90Days)}
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
      <EmergencyFundIndicator
        monthsCovered={monthsCovered}
        avgExpenses={avgExpenses}
        bankAmount={bankAmount}
        liquidAssetsTotal={liquidAssetsTotal}
        isLoading={isLoading || isEmergencyFundLoading}
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
      <DividendYieldIndicator yieldOnCost={yieldOnCost} isLoading={isLoading} />
      <NetWorthGrowthIndicator />
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
  } = useAssetsIndicators({ includeYield: true });

  const {
    data: { amount: bankAmount } = { amount: 0 },
    isPending: isBankAccountLoading,
  } = useBankAccount();

  const { total: emergencyFundAssetsTotal, isPending: isEmergencyFundAssetsLoading } =
    useEmergencyFundAssets();

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
      avgExpenses={expensesIndicators?.avg ?? 0}
      avgPassiveIncome={incomesIndicators?.avg ?? 0}
      bankAmount={bankAmount}
      liquidAssetsTotal={emergencyFundAssetsTotal}
      investmentsTotal={assetsIndicators?.total ?? 0}
      patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
      passiveIncomes90Days={passiveIncomes90Days}
      futureExpenses={expensesIndicators?.future ?? 0}
      futureRevenues={revenuesIndicators?.future ?? 0}
      yieldOnCost={assetsIndicators?.yield_on_cost ?? 0}
      isLoading={isLoading}
      isFutureExpensesLoading={isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading}
      isPassiveIncomeLoading={isIncomesIndicatorsLoading}
      isEmergencyFundLoading={isEmergencyFundAssetsLoading}
    />
  );
};
