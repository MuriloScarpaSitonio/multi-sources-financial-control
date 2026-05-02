import Button from "@mui/material/Button";
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

const ExpensesSimulator = ({
  value,
  onChange,
  onReset,
  avgExpenses,
  showReset,
}: {
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
  avgExpenses: number;
  showReset: boolean;
}) => {
  const step = 100;
  const max = Math.max(avgExpenses * 3, 10000);
  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
        Despesas mensais:
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
        value={value}
        onChange={(_, v) => onChange(v as number)}
        min={0}
        max={max}
        step={step}
        size="medium"
        sx={{ ...sliderSx, width: 160 }}
      />
      {showReset && (
        <Button variant="brand-text" size="small" onClick={onReset}>
          Resetar
        </Button>
      )}
    </Stack>
  );
};

export default ExpensesSimulator;
