import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import {
  Colors,
  FontSizes,
  NumberFormat,
  Text,
  getColor,
} from "../../../design-system";
import { sliderSx } from "./consts";
import { usePersistedValue } from "./usePersistedValue";

const ExpenseSimulator = ({
  value,
  onChange,
  onReset,
  avgMonthlyExpenses,
  showReset,
  enabled = false,
  isPersisting = false,
}: {
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  avgMonthlyExpenses: number;
  showReset: boolean;
  enabled?: boolean;
  isPersisting?: boolean;
}) => {
  const step = 100;
  const max = Math.max(avgMonthlyExpenses * 3, 5000);
  const { raw, commit, cancel, showSkeleton } = usePersistedValue(value, onChange, {
    enabled,
    isPersisting,
  });

  if (showSkeleton) {
    return <Skeleton variant="rounded" width={420} height={28} />;
  }

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Despesas mensais:
      </Text>
      <TextField
        value={raw}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v) && v >= 0) commit(v);
        }}
        size="small"
        slotProps={{
          input: {
            inputComponent: NumberFormat,
            inputProps: { prefix: "R$ ", decimalScale: 2 },
          } as any,
        }}
        sx={{
          width: 140,
          "& .MuiInputBase-input": {
            color: getColor(Colors.neutral0),
            fontSize: 12,
            py: 0.5,
          },
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: getColor(Colors.neutral600) },
          },
        }}
      />
      <Slider
        value={raw}
        onChange={(_, v) => commit(v as number)}
        min={0}
        max={max}
        step={step}
        size="medium"
        sx={{ ...sliderSx, width: 160 }}
      />
      {showReset && (
        <Button
          variant="brand-text"
          size="small"
          onClick={() => {
            cancel();
            onReset();
          }}
        >
          Resetar
        </Button>
      )}
    </Stack>
  );
};

export default ExpenseSimulator;
