import { useMemo } from "react";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link } from "react-router-dom";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useAssetsIndicators } from "../Assets/Indicators/hooks";
import { useAssetsReports } from "../Assets/Reports/AssetAggregationReports/hooks";
import { GroupBy, Kinds } from "../Assets/Reports/types";
import type { ReportAggregatedByTypeDataItem } from "../Assets/Reports/types";
import { useBankAccountsSummary } from "../Expenses/hooks";
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { useIncomesAvg } from "../Incomes/Indicators/hooks";
import { useHomeRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import DividendsOnlyIndicator from "../Home/DividendsOnlyIndicator";
import ConstantDollarIndicator from "../Home/ConstantDollarIndicator";
import OneOverNIndicator from "../Home/OneOverNIndicator";
import VPWIndicator from "../Home/VPWIndicator";
import { usePlanningPreferences } from "./hooks";
import { useSelectedMethod } from "./hooks";
import { getFirePlanningPreferences, type ActiveMethodKey } from "./api";
import { STRATEGY_CONTENT } from "./strategyContent";

const STRATEGY_ORDER: ActiveMethodKey[] = [
  "fire",
  "dividends_only",
  "one_over_n",
  "vpw",
];

const PlanningHub = () => {
  const { selectedMethod } = useSelectedMethod();
  const { data: planningData } = usePlanningPreferences();
  const firePreferences = getFirePlanningPreferences(planningData?.preferences);
  const dateOfBirth = planningData?.dateOfBirth ?? null;

  const {
    data: assetsIndicators,
    isPending: isAssetsLoading,
  } = useAssetsIndicators({ includeYield: true });
  const {
    data: { total: bankAmount } = { total: 0 },
    isPending: isBankLoading,
  } = useBankAccountsSummary();
  const {
    data: expensesIndicators,
    isPending: isExpensesLoading,
  } = useHomeExpensesIndicators({ includeFireAvg: true });
  const {
    data: { avg: avgPassiveIncome } = { avg: 0 },
    isPending: isIncomesLoading,
  } = useIncomesAvg();
  const {
    data: revenuesIndicators,
    isPending: isRevenuesLoading,
  } = useHomeRevenuesIndicators();
  const {
    data: assetsReportData,
    isPending: isReportsLoading,
  } = useAssetsReports({
    kind: Kinds.TOTAL_INVESTED,
    group_by: GroupBy.TYPE,
    current: true,
    percentage: false,
  });

  const patrimonyTotal = (assetsIndicators?.total ?? 0) + bankAmount;
  const avgExpenses = expensesIndicators?.fire_avg ?? 0;
  const avgMonthlySavings =
    (revenuesIndicators?.avg ?? 0) - (expensesIndicators?.avg ?? 0);
  const isDataLoading =
    isAssetsLoading || isBankLoading || isExpensesLoading || isRevenuesLoading;

  const { fixedIncomeTotal, variableIncomeTotal, equityTotal, ifixTotal } = useMemo(() => {
    const data = (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[];
    const fixed = data.find((d) => d.type === "Renda fixa BR")?.total ?? 0;
    const ifix = data.find((d) => d.type === "FII")?.total ?? 0;
    const equity = data
      .filter((d) => ["Ação BR", "Ação EUA", "Cripto"].includes(d.type))
      .reduce((sum, d) => sum + d.total, 0);
    return {
      fixedIncomeTotal: fixed,
      variableIncomeTotal: equity + ifix,
      equityTotal: equity,
      ifixTotal: ifix,
    };
  }, [assetsReportData]);

  const compactIndicators: Record<ActiveMethodKey, React.ReactNode> = {
    fire: (
      <ConstantDollarIndicator
        patrimonyTotal={patrimonyTotal}
        avgExpenses={avgExpenses}
        isLoading={isDataLoading || isReportsLoading}
        withdrawalRate={firePreferences.withdrawal_rate}
        onWithdrawalRateChange={() => {}}
        targetYears={firePreferences.target_years}
        onTargetYearsChange={() => {}}
        equityTotal={equityTotal}
        ifixTotal={ifixTotal}
        fixedIncomeTotal={fixedIncomeTotal + bankAmount}
        simulatedExpenses={firePreferences.monthly_expenses_override}
        excludeIfixFromSim={firePreferences.exclude_ifix_from_sim}
        compact
        hideLabel
      />
    ),
    dividends_only: (
      <DividendsOnlyIndicator
        avgPassiveIncome={avgPassiveIncome}
        avgExpenses={avgExpenses}
        patrimonyTotal={patrimonyTotal}
        isLoading={isDataLoading || isIncomesLoading}
        compact
        hideLabel
      />
    ),
    one_over_n: (
      <OneOverNIndicator
        patrimonyTotal={patrimonyTotal}
        avgExpenses={avgExpenses}
        avgMonthlySavings={avgMonthlySavings}
        isLoading={isDataLoading}
        dateOfBirth={dateOfBirth}
        targetDepletionAge={90}
        onTargetDepletionAgeChange={() => {}}
        realReturn={5}
        onRealReturnChange={() => {}}
        compact
        hideLabel
      />
    ),
    vpw: (
      <VPWIndicator
        equityTotal={equityTotal}
        ifixTotal={ifixTotal}
        fixedIncomeTotal={fixedIncomeTotal}
        avgExpenses={avgExpenses}
        avgMonthlySavings={avgMonthlySavings}
        isLoading={isDataLoading || isReportsLoading}
        dateOfBirth={dateOfBirth}
        targetAge={99}
        onTargetAgeChange={() => {}}
        stockReturn={5}
        onStockReturnChange={() => {}}
        bondReturn={3}
        onBondReturnChange={() => {}}
        compact
        hideLabel
      />
    ),
  };

  return (
    <Stack spacing={3} pb={3}>
      <Text weight={FontWeights.SEMI_BOLD}>Estratégias</Text>
      {STRATEGY_ORDER.map((key) => {
        const content = STRATEGY_CONTENT[key];
        const isActive = selectedMethod === key;

        return (
          <Link
            key={key}
            to={`/planning/${key}`}
            style={{ textDecoration: "none" }}
          >
            <Paper
              elevation={isActive ? 3 : 1}
              sx={{
                p: 3,
                borderRadius: 2,
                borderLeft: `4px solid ${isActive ? getColor(Colors.brand) : "transparent"}`,
                cursor: "pointer",
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: 4 },
              }}
            >
              <Stack gap={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack gap={0.5}>
                    <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.MEDIUM}>
                      {content.title}
                    </Text>
                    <Text size={FontSizes.SMALL} color={Colors.neutral400}>
                      {content.subtitle}
                    </Text>
                  </Stack>
                  {isActive && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="Estratégia ativa"
                      color="success"
                      size="small"
                    />
                  )}
                </Stack>
                {compactIndicators[key]}
              </Stack>
            </Paper>
          </Link>
        );
      })}
    </Stack>
  );
};

export default PlanningHub;
