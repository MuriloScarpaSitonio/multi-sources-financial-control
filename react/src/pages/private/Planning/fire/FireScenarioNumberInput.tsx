import { useEffect, useId, useState } from "react";
import { NumericFormat } from "react-number-format";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import {
  Colors,
  FontSizes,
  InfoIconTooltip,
  getColor,
  getFontSize,
  Text,
} from "../../../../design-system";

const stepButtonSx = {
  minWidth: 28,
  width: 28,
  height: 28,
  p: 0,
  flexShrink: 0,
};

type Props = {
  label: string;
  tooltip?: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  decimalScale?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset?: () => void;
};

const FireScenarioNumberInput = ({
  label,
  tooltip,
  value,
  step,
  min = 0,
  max = Infinity,
  prefix,
  suffix,
  decimalScale = 8,
  disabled = false,
  onChange,
  onReset,
}: Props) => {
  const id = useId();
  const [draft, setDraft] = useState<number | "">(value);
  useEffect(() => setDraft(value), [value]);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const commit = (next: number) => {
    const bounded = clamp(next);
    setDraft(bounded);
    onChange(bounded);
  };
  const current = draft === "" ? value : draft;

  return (
    <Stack gap={0.5} sx={{ width: "100%", maxWidth: 244 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 20 }}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Text
            component="label"
            htmlFor={id}
            size={FontSizes.EXTRA_SMALL}
            color={Colors.neutral400}
          >
            {label}
          </Text>
          {tooltip && (
            <Text
              component="span"
              size={FontSizes.EXTRA_SMALL}
              extraStyle={{ display: "inline-flex", flexShrink: 0 }}
            >
              <InfoIconTooltip text={tooltip} />
            </Text>
          )}
        </Stack>
        {onReset && (
          <Button
            variant="brand-text"
            sx={{
              py: 0,
              minHeight: 20,
              fontSize: getFontSize(FontSizes.EXTRA_SMALL),
            }}
            size="small"
            disabled={disabled}
            onClick={onReset}
            aria-label={`Resetar ${label}`}
          >
            Resetar
          </Button>
        )}
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Button
          variant="brand-text"
          size="small"
          sx={stepButtonSx}
          aria-label={`Diminuir ${label}`}
          disabled={disabled || current <= min}
          onClick={() => commit((Math.ceil(current / step) - 1) * step)}
        >
          <RemoveIcon sx={{ fontSize: getFontSize(FontSizes.SMALL) }} />
        </Button>
        <NumericFormat
          customInput={TextField}
          id={id}
          value={draft}
          size="small"
          fullWidth
          disabled={disabled}
          prefix={prefix}
          suffix={suffix}
          thousandSeparator="."
          decimalSeparator=","
          decimalScale={decimalScale}
          allowNegative={false}
          onValueChange={({ floatValue }, source) => {
            if (source.source !== "event") return;
            setDraft(floatValue ?? "");
            if (
              floatValue !== undefined &&
              floatValue >= min &&
              floatValue <= max
            )
              onChange(floatValue);
          }}
          onBlur={() => {
            if (draft === "") setDraft(value);
            else if (draft < min || draft > max) commit(draft);
          }}
          slotProps={{
            htmlInput: {
              inputMode: decimalScale === 0 ? "numeric" : "decimal",
              style: { textAlign: "center" },
            },
          }}
          sx={{
            minWidth: 0,
            "& .MuiInputBase-input": {
              color: getColor(Colors.neutral0),
              fontSize: getFontSize(FontSizes.EXTRA_SMALL),
              py: 0.5,
              px: 1,
            },
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: getColor(Colors.neutral600) },
              "&.Mui-focused fieldset": {
                borderColor: getColor(Colors.brand200),
              },
            },
          }}
        />
        <Button
          variant="brand-text"
          size="small"
          sx={stepButtonSx}
          aria-label={`Aumentar ${label}`}
          disabled={disabled || current >= max}
          onClick={() => commit((Math.floor(current / step) + 1) * step)}
        >
          <AddIcon sx={{ fontSize: getFontSize(FontSizes.SMALL) }} />
        </Button>
      </Stack>
    </Stack>
  );
};

export default FireScenarioNumberInput;
