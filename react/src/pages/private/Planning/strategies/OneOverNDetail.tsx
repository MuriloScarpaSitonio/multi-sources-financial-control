import Link from "@mui/material/Link";
import {
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import Stack from "@mui/material/Stack";
import { FontSizes } from "../../../../design-system";
import {
  getOneOverNPlanningPreferences,
  type OneOverNPlanningPreferences,
} from "../api";
import StrategyExplanationPanels from "../shared/StrategyExplanationPanels";
import { useFireAllocation } from "../fireAllocation";
import {
  usePlanningPreferences,
  useSelectedMethod,
  useUpdatePlanningPreferences,
} from "../hooks";
import StrategyHeader from "../StrategyHeader";
import { STRATEGY_CONTENT } from "../strategyContent";
import { useStrategyCommonData } from "../useStrategyCommonData";
import OneOverNMethodologyWalkthrough from "../oneOverN/OneOverNMethodologyWalkthrough";
import OneOverNStudio from "../oneOverN/OneOverNStudio";
import type { OneOverNDraft } from "../oneOverN/oneOverNScenario";
import { ageFromBirthDate } from "../vpw/vpwScenario";

export default function OneOverNDetail() {
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === "one_over_n";
  const {
    data: planningData,
    isError: planningError,
    isPending: planningLoading,
    refetch: retryPlanning,
  } = usePlanningPreferences();
  const savedKey = JSON.stringify(
    getOneOverNPlanningPreferences(planningData?.preferences),
  );
  const [preferences, setPreferences] = useState(() =>
    getOneOverNPlanningPreferences(planningData?.preferences),
  );
  const edited = useRef(false);
  useLayoutEffect(() => {
    if (!edited.current) setPreferences(JSON.parse(savedKey));
  }, [savedKey]);
  const [simulatedPatrimony, setSimulatedPatrimony] = useState<number | null>(
    null,
  );
  const { mutate: updatePreferences, isPending: isUpdating } =
    useUpdatePlanningPreferences();
  const common = useStrategyCommonData();
  const {
    data: allocationData,
    isPending: allocationLoading,
    isError: allocationError,
    refetch: retryAllocation,
  } = useFireAllocation();
  const dataError = Boolean(
    planningError ||
    allocationError ||
    common.isError ||
    (!planningLoading && !planningData) ||
    (!allocationLoading && !Array.isArray(allocationData?.buckets)) ||
    (!common.isLoading && !common.hasRequiredData),
  );
  const draft = useMemo<OneOverNDraft>(
    () => ({
      isReady:
        Boolean(planningData) &&
        !common.isLoading &&
        !allocationLoading &&
        !dataError &&
        common.hasRequiredData,
      currentAge: ageFromBirthDate(planningData?.dateOfBirth ?? null),
      allocation: allocationData?.buckets ?? [],
      preferences,
      simulatedPatrimony,
      avgExpenses: common.avgExpenses,
      monthlySavings: common.derivedMonthlySavings,
    }),
    [
      planningData,
      common.isLoading,
      common.avgExpenses,
      common.derivedMonthlySavings,
      allocationLoading,
      dataError,
      common.hasRequiredData,
      allocationData,
      preferences,
      simulatedPatrimony,
    ],
  );
  const isDirty =
    Boolean(planningData) && JSON.stringify(preferences) !== savedKey;
  const change = (patch: OneOverNPlanningPreferences) => {
    edited.current = true;
    setPreferences((current) => ({ ...current, ...patch }));
  };
  const renderHeader = (actions: ReactNode) => (
    <StrategyHeader
      sticky
      activeBadgeByTitle
      title={STRATEGY_CONTENT.one_over_n.title}
      subtitle={STRATEGY_CONTENT.one_over_n.subtitle}
      titleSize={FontSizes.REGULAR}
      subtitleSize={FontSizes.EXTRA_SMALL}
      isActive={isActive}
      isMutating={isUpdating}
      onSelect={() => updatePreferences({ selected_method: "one_over_n" })}
      isDirty={isDirty}
      onSave={() => {
        edited.current = false;
        updatePreferences({ one_over_n: preferences });
      }}
      actions={actions}
    />
  );
  return (
    <Stack spacing={3} pb={3} sx={{ mr: -6 }}>
      <OneOverNStudio
        dataError={dataError}
        onRetryData={() => {
          void Promise.allSettled([
            retryPlanning(),
            retryAllocation(),
            common.retry(),
          ]);
        }}
        draft={draft}
        isPersisting={isUpdating}
        onPreferencesChange={change}
        onPatrimonyChange={setSimulatedPatrimony}
        renderHeader={renderHeader}
        renderExplanation={(snapshot, output) => (
          <StrategyExplanationPanels
            walkthrough={
              snapshot && (
                <OneOverNMethodologyWalkthrough
                  snapshot={snapshot}
                  output={output}
                />
              )
            }
            about={
              <>
                Na estratégia 1/N, a cada ano você divide o patrimônio pelos
                anos restantes até a idade alvo e gasta o valor calculado. A
                retirada varia conforme o saldo e o tempo restante. No último
                ano, você retira todo o saldo.{" "}
                <Link
                  href="https://www.bogleheads.org/wiki/Withdrawal_methods#1/N_withdrawal_amounts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conheça o método original
                </Link>
                .
              </>
            }
          />
        )}
      />
    </Stack>
  );
}
