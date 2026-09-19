import type { Ref } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import {
  Colors,
  FontSizes,
  getFontSize,
  Text,
} from "../../../../design-system";
import type { FirePlanningPreferences } from "../api";
import type { FireAllocationBucket } from "../fireAllocation";
import FireHistoricalDrawer from "./FireHistoricalDrawer";
import { historicalSummary } from "./fireHistoricalDatasets";

const FireHistoricalSettings = ({
  allocation,
  preferences,
  showAgeInBonds,
  open,
  onOpenChange,
  onApply,
  controlsRef,
}: {
  allocation: readonly FireAllocationBucket[];
  preferences: Required<FirePlanningPreferences>;
  showAgeInBonds: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (
    overrides: Required<FirePlanningPreferences>["historical_series_overrides"],
    fallbacks: Required<FirePlanningPreferences>["historical_series_fallbacks"],
  ) => void;
  controlsRef?: Ref<HTMLDivElement>;
}) => {
  const history = historicalSummary(allocation, preferences, showAgeInBonds);
  return (
    <>
      <Stack gap={0.5} ref={controlsRef} tabIndex={-1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Text size={FontSizes.EXTRA_SMALL}>Dados históricos</Text>
          <Button
            variant="brand-text"
            size="small"
            aria-label="Configurar históricos"
            sx={{
              py: 0.25,
              px: 1,
              minWidth: 0,
              fontSize: getFontSize(FontSizes.EXTRA_SMALL),
            }}
            onClick={() => onOpenChange(true)}
          >
            Configurar
          </Button>
        </Stack>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          Período disponível: {history.label}
        </Text>
      </Stack>
      {open && (
        <FireHistoricalDrawer
          allocation={allocation}
          preferences={preferences}
          showAgeInBonds={showAgeInBonds}
          onClose={() => onOpenChange(false)}
          onApply={(overrides, fallbacks) => {
            onApply(overrides, fallbacks);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
};
export default FireHistoricalSettings;
