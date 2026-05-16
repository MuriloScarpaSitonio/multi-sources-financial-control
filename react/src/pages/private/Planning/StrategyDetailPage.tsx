import { useMemo, useState } from "react";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Navigate, useParams, Link } from "react-router-dom";

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
import GalenoIndicator from "../Home/GalenoIndicator";
import OneOverNIndicator from "../Home/OneOverNIndicator";
import AgeInBondsIndicator from "../Home/AgeInBondsIndicator";
import ConstantDollarAgeInBondsIndicator from "../Home/ConstantDollarAgeInBondsIndicator";
import VPWIndicator from "../Home/VPWIndicator";
import AgeInBondsExplainer from "./AgeInBondsExplainer";
import FireMethodologyWalkthrough from "./FireMethodologyWalkthrough";
import {
  usePlanningPreferences,
  useSelectedMethod,
  useUpdatePlanningPreferences,
} from "./hooks";
import type { ActiveMethodKey } from "./api";
import {
  STRATEGY_CONTENT,
  GALENO_RATIONALE,
  GALENO_PROS,
  GALENO_CONS,
  AGE_IN_BONDS_TITLES,
} from "./strategyContent";
import type { ProConItem } from "./strategyContent";

const VALID_METHODS = Object.keys(STRATEGY_CONTENT) as ActiveMethodKey[];

// Galeno is parked while we redesign it as a standalone strategy with its own
// withdrawal mechanics (see docs/superpowers/plans/2026-04-26-galeno-strategy.md).
// Re-enable by restoring the original list and removing this comment.
const GALENO_METHODS: ActiveMethodKey[] = [];
const AGE_IN_BONDS_METHODS: ActiveMethodKey[] = ["fire"];

const StrategyDetailPage = () => {
  const { method } = useParams<{ method: string }>();

  if (!method || !VALID_METHODS.includes(method as ActiveMethodKey)) {
    return <Navigate to="/planning" />;
  }

  return <StrategyDetail method={method as ActiveMethodKey} />;
};

const StrategyDetail = ({ method }: { method: ActiveMethodKey }) => {
  // Slider state
  const [fireWithdrawalRate, setFireWithdrawalRate] = useState(4);
  const [realReturn, setRealReturn] = useState(5);
  const [targetYears, setTargetYears] = useState(30);
  const [galenoTransferRate, setGalenoTransferRate] = useState(6);
  const [galenoTargetBufferYears, setGalenoTargetBufferYears] = useState(7);
  const [targetDepletionAge, setTargetDepletionAge] = useState(90);
  const [ageInBondsWithdrawalRate, setAgeInBondsWithdrawalRate] = useState(4);
  const [ageInBondsStockReturn, setAgeInBondsStockReturn] = useState(5);
  const [ageInBondsBondReturn, setAgeInBondsBondReturn] = useState(3);
  const [vpwTargetAge, setVpwTargetAge] = useState(99);
  const [vpwStockReturn, setVpwStockReturn] = useState(5);
  const [vpwBondReturn, setVpwBondReturn] = useState(4);

  // Toggle state
  const [localGaleno, setLocalGaleno] = useState(false);
  const [localAgeInBonds, setLocalAgeInBonds] = useState(false);
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);

  // Lifted what-if state so the FIRE indicator and its result sections stay
  // synchronized when the user edits patrimony or expenses.
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(
    null,
  );
  const [simulatedExpenses, setSimulatedExpenses] = useState<number | null>(
    null,
  );

  // Data hooks
  const { selectedMethod } = useSelectedMethod();
  const { data: planningData } = usePlanningPreferences();
  const preferences = planningData?.preferences;
  const dateOfBirth = planningData?.dateOfBirth ?? null;
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();

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
  const derivedMonthlySavings =
    (revenuesIndicators?.avg ?? 0) - (expensesIndicators?.avg ?? 0);
  // Slider override: null = use the derived avgRevenues − avgExpenses default;
  // any number = user has dragged the slider and that value sticks.
  const [monthlySavingsOverride, setMonthlySavingsOverride] = useState<
    number | null
  >(null);
  const monthlySavings = monthlySavingsOverride ?? derivedMonthlySavings;
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

  const isActive = selectedMethod === method;
  // Galeno parked — see GALENO_METHODS comment above. Force-hide regardless of
  // any stale `show_galeno: true` preference so users don't see an orphaned
  // indicator with the toggle gone.
  const showGaleno = false;
  const showAgeInBonds = isActive ? (preferences?.show_age_in_bonds ?? false) : localAgeInBonds;

  const hasGalenoToggle = GALENO_METHODS.includes(method);
  const hasAgeInBondsToggle = AGE_IN_BONDS_METHODS.includes(method);

  const handleSelect = () => {
    updatePreferences({ selected_method: method });
  };

  const handleGalenoChange = (checked: boolean) => {
    if (isActive) {
      updatePreferences({ show_galeno: checked });
    } else {
      setLocalGaleno(checked);
    }
  };

  const handleAgeInBondsChange = (checked: boolean) => {
    if (isActive) {
      updatePreferences({ show_age_in_bonds: checked });
    } else {
      setLocalAgeInBonds(checked);
    }
  };

  const content = STRATEGY_CONTENT[method];
  const displayTitle = showAgeInBonds
    ? (AGE_IN_BONDS_TITLES[method]?.title ?? content.title)
    : content.title;

  const galenoProps = {
    reportData: (assetsReportData ?? []) as ReportAggregatedByTypeDataItem[],
    bankAmount,
    avgExpenses,
    isLoading: isDataLoading || isReportsLoading,
    transferRate: galenoTransferRate,
    onTransferRateChange: setGalenoTransferRate,
    targetBufferYears: galenoTargetBufferYears,
    onTargetBufferYearsChange: setGalenoTargetBufferYears,
  };

  // Galeno copy still threads through pros/cons/rationaleExtra here since
  // its toggle is parked but the constants remain. Idade em RF moved out:
  // when the toggle is on, AgeInBondsExplainer renders a self-contained
  // panel below, so we no longer splice its copy into the global lists.
  const pros: ProConItem[] = [
    ...content.pros,
    ...(showGaleno ? GALENO_PROS : []),
  ];
  const cons: ProConItem[] = [
    ...content.cons,
    ...(showGaleno ? GALENO_CONS : []),
  ];

  const rationaleExtra: string[] = [];
  if (showGaleno) rationaleExtra.push(GALENO_RATIONALE);

  const indicator = (() => {
    switch (method) {
      case "fire":
        return showAgeInBonds ? (
          <ConstantDollarAgeInBondsIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading || isReportsLoading}
            dateOfBirth={dateOfBirth}
            withdrawalRate={fireWithdrawalRate}
            onWithdrawalRateChange={setFireWithdrawalRate}
            targetYears={targetYears}
            onTargetYearsChange={setTargetYears}
            fixedIncomeTotal={fixedIncomeTotal}
            variableIncomeTotal={variableIncomeTotal}
            equityTotal={equityTotal}
            ifixTotal={ifixTotal}
            monthlySavings={monthlySavings}
            defaultMonthlySavings={derivedMonthlySavings}
            onMonthlySavingsChange={setMonthlySavingsOverride}
            onMonthlySavingsReset={() => setMonthlySavingsOverride(null)}
            isMonthlySavingsOverridden={monthlySavingsOverride !== null}
          />
        ) : (
          <ConstantDollarIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            isLoading={isDataLoading || isReportsLoading}
            withdrawalRate={fireWithdrawalRate}
            onWithdrawalRateChange={setFireWithdrawalRate}
            targetYears={targetYears}
            onTargetYearsChange={setTargetYears}
            equityTotal={equityTotal}
            ifixTotal={ifixTotal}
            fixedIncomeTotal={fixedIncomeTotal + bankAmount}
            monthlySavings={monthlySavings}
            defaultMonthlySavings={derivedMonthlySavings}
            onMonthlySavingsChange={setMonthlySavingsOverride}
            onMonthlySavingsReset={() => setMonthlySavingsOverride(null)}
            isMonthlySavingsOverridden={monthlySavingsOverride !== null}
            dateOfBirth={dateOfBirth}
            simulatedPatrimony={simulatedPatrimony}
            onSimulatedPatrimonyChange={setSimulatedPatrimony}
            simulatedExpenses={simulatedExpenses}
            onSimulatedExpensesChange={setSimulatedExpenses}
          />
        );
      case "dividends_only":
        return (
          <DividendsOnlyIndicator
            avgPassiveIncome={avgPassiveIncome}
            avgExpenses={avgExpenses}
            patrimonyTotal={patrimonyTotal}
            isLoading={isDataLoading || isIncomesLoading}
          />
        );
      case "one_over_n":
        return (
          <OneOverNIndicator
            patrimonyTotal={patrimonyTotal}
            avgExpenses={avgExpenses}
            avgMonthlySavings={derivedMonthlySavings}
            isLoading={isDataLoading}
            dateOfBirth={dateOfBirth}
            targetDepletionAge={targetDepletionAge}
            onTargetDepletionAgeChange={setTargetDepletionAge}
            realReturn={realReturn}
            onRealReturnChange={setRealReturn}
          />
        );
      case "vpw":
        return (
          <VPWIndicator
            equityTotal={equityTotal}
            ifixTotal={ifixTotal}
            fixedIncomeTotal={fixedIncomeTotal}
            avgExpenses={avgExpenses}
            avgMonthlySavings={derivedMonthlySavings}
            isLoading={isDataLoading || isReportsLoading}
            dateOfBirth={dateOfBirth}
            targetAge={vpwTargetAge}
            onTargetAgeChange={setVpwTargetAge}
            stockReturn={vpwStockReturn}
            onStockReturnChange={setVpwStockReturn}
            bondReturn={vpwBondReturn}
            onBondReturnChange={setVpwBondReturn}
          />
        );
    }
  })();

  return (
    <Stack spacing={3} pb={3}>
      {/* Back link */}
      <Link to="/planning" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
        <Button
          variant="text"
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: "none", color: getColor(Colors.neutral400) }}
        >
          Voltar
        </Button>
      </Link>

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack gap={0.5}>
          <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.LARGE}>
            {displayTitle}
          </Text>
          <Text size={FontSizes.SMALL} color={Colors.neutral400}>
            {content.subtitle}
          </Text>
        </Stack>
        {isActive ? (
          <Chip
            icon={<CheckCircleIcon />}
            label="Estratégia ativa"
            color="success"
            size="small"
          />
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={handleSelect}
            disabled={isUpdating}
          >
            Selecionar como ativa
          </Button>
        )}
      </Stack>

      {/* Full indicator */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        {indicator}
      </Paper>

      {method !== "fire" && content.defaultsExplained.length > 0 && (
        <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Button
            size="small"
            onClick={() => setDefaultsExpanded(!defaultsExpanded)}
            endIcon={defaultsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            Entenda esses valores
          </Button>
          <Collapse in={defaultsExpanded}>
            <Stack gap={2} mt={1}>
              {content.defaultsExplained.map((item) => (
                <Stack key={item.label} gap={0.5}>
                  <Text size={FontSizes.SMALL} weight={FontWeights.MEDIUM}>
                    {item.label}
                  </Text>
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                    {item.explanation}
                  </Text>
                </Stack>
              ))}
              {method === "vpw" && (
                <Stack
                  mt={2}
                  sx={{
                    pt: 2,
                    borderTop: "1px solid",
                    borderColor: getColor(Colors.neutral400),
                  }}
                >
                  <FireMethodologyWalkthrough />
                </Stack>
              )}
            </Stack>
          </Collapse>
        </Paper>
      )}

      {/* Fire age-in-bonds keeps the legacy panel for now because its
          glide-path dynamics have a separate explanation path. */}
      {method === "fire" && showAgeInBonds && content.defaultsExplained.length > 0 && (
        <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
          <Button
            size="small"
            onClick={() => setDefaultsExpanded(!defaultsExpanded)}
            endIcon={defaultsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            Entenda esses valores
          </Button>
          <Collapse in={defaultsExpanded}>
            <Stack gap={2} mt={1}>
              {content.defaultsExplained.map((item) => (
                <Stack key={item.label} gap={0.5}>
                  <Text size={FontSizes.SMALL} weight={FontWeights.MEDIUM}>
                    {item.label}
                  </Text>
                  <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                    {item.explanation}
                  </Text>
                </Stack>
              ))}
              <Stack
                mt={2}
                sx={{
                  pt: 2,
                  borderTop: "1px solid",
                  borderColor: getColor(Colors.neutral400),
                }}
              >
                <FireMethodologyWalkthrough />
              </Stack>
            </Stack>
          </Collapse>
        </Paper>
      )}

      {/* Toggles */}
      {(hasAgeInBondsToggle || hasGalenoToggle) && (
        <Stack gap={1}>
          {hasAgeInBondsToggle && (
            <FormControlLabel
              control={
                <Switch
                  checked={showAgeInBonds}
                  onChange={(_, value) => handleAgeInBondsChange(value)}
                  disabled={isActive && isUpdating}
                  size="small"
                />
              }
              label="Alocação Idade em Renda Fixa"
              slotProps={{ typography: { variant: "caption" } }}
            />
          )}
          {hasGalenoToggle && !showAgeInBonds && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={showGaleno}
                    onChange={(_, value) => handleGalenoChange(value)}
                    disabled={isActive && isUpdating}
                    size="small"
                  />
                }
                label="Incluir colchão de renda fixa (Galeno)"
                slotProps={{ typography: { variant: "caption" } }}
              />
              {showGaleno && <GalenoIndicator {...galenoProps} />}
            </>
          )}
        </Stack>
      )}

      {showAgeInBonds && (
        <AgeInBondsExplainer
          dateOfBirth={dateOfBirth}
          fixedIncomeTotal={fixedIncomeTotal}
          variableIncomeTotal={variableIncomeTotal}
        />
      )}

      {/* Expanded rationale */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Stack gap={2}>
          <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.MEDIUM}>
            Entenda a estratégia
          </Text>
          <Text size={FontSizes.SMALL} color={Colors.neutral400}>
            {content.rationale}
          </Text>
          {rationaleExtra.map((text, i) => (
            <Text key={`extra-${i}`} size={FontSizes.SMALL} color={Colors.neutral400} style={{ fontStyle: "italic" }}>
              {text}
            </Text>
          ))}
        </Stack>
      </Paper>

      {/* Pros / Cons */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Stack direction="row" gap={4}>
          <Stack gap={1} flex={1}>
            <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD} color={Colors.brand500}>
              Prós
            </Text>
            {pros.map((item) => (
              <Text
                key={item.text}
                size={FontSizes.EXTRA_SMALL}
                color={Colors.neutral400}
                style={item.galeno ? { fontStyle: "italic" } : undefined}
              >
                + {item.galeno ? `[Galeno] ${item.text}` : item.text}
              </Text>
            ))}
          </Stack>
          <Stack gap={1} flex={1}>
            <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD} color={Colors.danger200}>
              Contras
            </Text>
            {cons.map((item) => (
              <Text
                key={item.text}
                size={FontSizes.EXTRA_SMALL}
                color={Colors.neutral400}
                style={item.galeno ? { fontStyle: "italic" } : undefined}
              >
                − {item.galeno ? `[Galeno] ${item.text}` : item.text}
              </Text>
            ))}
          </Stack>
        </Stack>
      </Paper>


    </Stack>
  );
};

export default StrategyDetailPage;
