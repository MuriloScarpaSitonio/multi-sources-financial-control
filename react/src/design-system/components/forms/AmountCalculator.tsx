import { useRef, useState } from "react";
import CalculateOutlined from "@mui/icons-material/CalculateOutlined";
import BackspaceOutlined from "@mui/icons-material/BackspaceOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Mexp from "math-expression-evaluator";

import { Colors, FontSizes } from "../../enums";
import { getColor } from "../../utils";
import Text from "../Text";

const evaluator = new Mexp();
const keys = [
  "7",
  "8",
  "9",
  "÷",
  "4",
  "5",
  "6",
  "×",
  "1",
  "2",
  "3",
  "−",
  ",",
  "0",
  "⌫",
  "+",
];
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const cents = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumFractionDigits: 2,
});
const groupedAmount = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
const decimalAmount = /^(?:\d+|\d*[.,]\d+)$/;

function calculate(expression: string) {
  const arithmetic = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const parts = arithmetic.trim().split(/\s*([+*/-])\s*/);
  for (let i = 0; i < parts.length; i += 2) {
    const amount = parts[i];
    if (groupedAmount.test(amount)) {
      parts[i] = amount.replace(/\./g, "").replace(",", ".");
    } else if (decimalAmount.test(amount)) {
      parts[i] = amount.replace(",", ".");
    } else {
      return null;
    }
  }
  const total = evaluator.eval(parts.join(""));
  const rounded = Number(cents.format(total));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}

export default function AmountCalculator({
  value,
  onApply,
}: {
  value: number | string | undefined;
  onApply: (amount: number | "") => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expression, setExpression] = useState("");
  const result = calculate(expression);

  function updateExpression(next: string) {
    setExpression(next);
    const amount = calculate(next);
    if (amount !== null) onApply(amount);
    else if (next === "") onApply("");
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label="Abrir calculadora"
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        title="Abrir calculadora"
        sx={{ color: getColor(Colors.neutral300) }}
        onClick={(event) => {
          setExpression(
            value
              ? Number(value).toLocaleString("pt-BR", {
                  useGrouping: false,
                  maximumFractionDigits: 2,
                })
              : "",
          );
          setAnchor(event.currentTarget);
        }}
      >
        <CalculateOutlined fontSize="small" />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          transition: {
            onEntering: () => queueMicrotask(() => inputRef.current?.focus()),
          },
        }}
        PaperProps={{
          role: "dialog",
          "aria-label": "Calculadora",
          sx: {
            backgroundColor: getColor(Colors.neutral600),
            backgroundImage: "none",
            border: `1px solid ${getColor(Colors.neutral400)}`,
          },
        }}
      >
        <Stack spacing={1} sx={{ p: 1.5, width: 232, boxSizing: "border-box" }}>
          <TextField
            autoFocus
            inputRef={inputRef}
            size="small"
            label="Cálculo"
            variant="standard"
            placeholder="12,50 + 3"
            value={expression}
            onChange={(event) => updateExpression(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "=") {
                event.preventDefault();
                if (result !== null) setAnchor(null);
              }
            }}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 0.5,
            }}
          >
            {keys.map((key) => (
              <Button
                key={key}
                variant="neutral"
                size="small"
                sx={{ minWidth: 0 }}
                aria-label={key === "⌫" ? "Apagar último caractere" : undefined}
                onClick={() => {
                  updateExpression(
                    key === "⌫" ? expression.slice(0, -1) : expression + key,
                  );
                  inputRef.current?.focus();
                }}
              >
                {key === "⌫" ? <BackspaceOutlined fontSize="small" /> : key}
              </Button>
            ))}
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Button
              size="small"
              variant="brand-text"
              onClick={() => {
                updateExpression("");
                inputRef.current?.focus();
              }}
            >
              Limpar
            </Button>
            <Text component="output" size={FontSizes.SEMI_SMALL}>
              {result === null ? "" : money.format(result)}
            </Text>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
