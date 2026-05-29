import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import {
  Colors,
  FontSizes,
  getColor,
  NumberFormat,
  Text,
} from "../../../design-system";
import { sliderSx } from "./consts";
import { usePersistedValue } from "./usePersistedValue";

const PatrimonySimulator = ({
  value,
  onChange,
  onReset,
  patrimonyTotal,
  showReset,
  isPersisting = false,
}: {
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  patrimonyTotal: number;
  showReset: boolean;
  isPersisting?: boolean;
}) => {
  const patrimonyStep = 50000;
  const patrimonyMax = Math.max(patrimonyTotal * 5, 1000000);
  // Local what-if: never debounced (enabled stays false), but still skeletons
  // with the rest of the panel while a sibling save is in flight.
  const { raw, commit, cancel, showSkeleton } = usePersistedValue(value, onChange, {
    isPersisting,
  });

  if (showSkeleton) {
    return <Skeleton variant="rounded" width={480} height={28} />;
  }

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Patrimônio:
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
          width: 180,
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
        max={patrimonyMax}
        step={patrimonyStep}
        size="medium"
        sx={{ ...sliderSx, width: 200 }}
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

export default PatrimonySimulator;
