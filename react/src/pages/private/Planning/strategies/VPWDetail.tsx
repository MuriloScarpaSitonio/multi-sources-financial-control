import Link from "@mui/material/Link";
import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import Stack from "@mui/material/Stack";
import { FontSizes } from "../../../../design-system";
import { getVPWPlanningPreferences, type VPWPlanningPreferences } from "../api";
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
import VPWMethodologyWalkthrough from "../vpw/VPWMethodologyWalkthrough";
import VPWStudio from "../vpw/VPWStudio";
import { ageFromBirthDate, type VPWDraft } from "../vpw/vpwScenario";

export default function VPWDetail() {
  const { selectedMethod } = useSelectedMethod();
  const isActive = selectedMethod === "vpw";
  const { data: planningData, isError: planningError } =
    usePlanningPreferences();
  const savedKey = JSON.stringify(
    getVPWPlanningPreferences(planningData?.preferences),
  );
  const [preferences, setPreferences] = useState(() =>
    getVPWPlanningPreferences(planningData?.preferences),
  );
  useLayoutEffect(() => {
    setPreferences(JSON.parse(savedKey));
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
  } = useFireAllocation();
  const dataError = Boolean(planningError || allocationError || common.isError);
  const draft = useMemo<VPWDraft>(
    () => ({
      isReady:
        Boolean(planningData) &&
        !common.isLoading &&
        !allocationLoading &&
        !dataError,
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
      allocationData,
      preferences,
      simulatedPatrimony,
    ],
  );
  const isDirty =
    Boolean(planningData) && JSON.stringify(preferences) !== savedKey;
  const change = (patch: VPWPlanningPreferences) =>
    setPreferences((current) => ({ ...current, ...patch }));
  const renderHeader = (actions: ReactNode) => (
    <StrategyHeader
      sticky
      activeBadgeByTitle
      title={STRATEGY_CONTENT.vpw.title}
      subtitle={STRATEGY_CONTENT.vpw.subtitle}
      titleSize={FontSizes.REGULAR}
      subtitleSize={FontSizes.EXTRA_SMALL}
      isActive={isActive}
      isMutating={isUpdating}
      onSelect={() => updatePreferences({ selected_method: "vpw" })}
      isDirty={isDirty}
      onSave={() => {
        updatePreferences({ vpw: preferences });
      }}
      actions={actions}
    />
  );
  return (
    <Stack spacing={3} pb={3} sx={{ mr: -6 }}>
      <VPWStudio
        dataError={dataError}
        draft={draft}
        isPersisting={isUpdating}
        onPreferencesChange={change}
        onPatrimonyChange={setSimulatedPatrimony}
        renderHeader={renderHeader}
        renderExplanation={(snapshot) => (
          <StrategyExplanationPanels
            walkthrough={
              snapshot && <VPWMethodologyWalkthrough snapshot={snapshot} />
            }
            about={
              <>
                O <em>Variable Percentage Withdrawal</em> foi desenvolvido pela
                comunidade Bogleheads para ajustar as retiradas ao patrimônio e
                ao tempo restante da aposentadoria. Nossa implementação adapta o
                método para retiradas mensais, limitadas aos gastos informados,
                e usa os históricos da sua carteira.{" "}
                <Link
                  href="https://www.bogleheads.org/wiki/Variable_percentage_withdrawal"
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
