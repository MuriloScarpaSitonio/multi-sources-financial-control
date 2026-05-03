import Button from "@mui/material/Button";
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

const PatrimonySimulator = ({
  value,
  onChange,
  onReset,
  patrimonyTotal,
  showReset,
}: {
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  patrimonyTotal: number;
  showReset: boolean;
}) => {
  const patrimonyStep = 50000;
  const patrimonyMax = Math.max(patrimonyTotal * 5, 1000000);

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Patrimônio:
      </Text>
      <TextField
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v) && v >= 0) onChange(v);
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
        value={value}
        onChange={(_, v) => onChange(v as number)}
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
          onClick={onReset}
        >
          Resetar
        </Button>
      )}
    </Stack>
  );
};

export default PatrimonySimulator;
