import type { ReactElement, ReactNode } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../../design-system";
import type { FireSuccessBand } from "../../Home/fireResultPresentation";
import { ChartFrame } from "./ChartFrame";

export type PercentileKey = "p10" | "p50" | "p90";
export type PercentileVisibility = Record<PercentileKey, boolean>;

export const successToneColor = (tone: FireSuccessBand) => {
  if (tone === "good") return getColor(Colors.brand);
  if (tone === "warn") return "#f59e0b";
  return getColor(Colors.danger200);
};

export const compactNumberTick = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const PERCENTILES = {
  p90: {
    toggle: "Otimista",
    line: "p90 (otimista)",
    color: Colors.brand,
    width: 1.5,
    dash: "4 3",
  },
  p50: {
    toggle: "Mediana",
    line: "Mediana",
    color: Colors.brand200,
    width: 2,
    dash: undefined,
  },
  p10: {
    toggle: "Pessimista",
    line: "p10 (pessimista)",
    color: Colors.danger200,
    width: 1.5,
    dash: "4 3",
  },
} as const;

export const percentileColor = (key: PercentileKey) =>
  getColor(PERCENTILES[key].color);

export const SuccessVerdictCard = ({
  band,
  verdict,
  rate,
  children,
  sx,
}: {
  band: FireSuccessBand;
  verdict: string;
  rate: string;
  children: ReactNode;
  sx?: object;
}) => (
  <Stack
    alignItems="center"
    gap={0.75}
    sx={{
      border: "1px solid",
      borderColor: getColor(Colors.neutral600),
      borderRadius: 1,
      py: 2,
      px: 2,
      backgroundColor: getColor(Colors.neutral900),
      textAlign: "center",
      ...sx,
    }}
  >
    <Text
      size={FontSizes.SMALL}
      weight={FontWeights.SEMI_BOLD}
      extraStyle={{ color: successToneColor(band) }}
    >
      {verdict}
    </Text>
    <Text
      size={FontSizes.SEMI_LARGE}
      weight={FontWeights.BOLD}
      extraStyle={{ color: successToneColor(band), lineHeight: 1 }}
    >
      {rate}
    </Text>
    <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
      {children}
    </Text>
  </Stack>
);

export const GoalProgressBar = ({
  progress,
  goalLabel,
  tooltip,
  hideValues,
}: {
  progress: number;
  goalLabel: string;
  tooltip: string;
  hideValues: boolean;
}) => (
  <Tooltip arrow describeChild title={tooltip}>
    <Box tabIndex={0} sx={{ position: "relative", mt: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={hideValues ? 0 : Math.min(100, Math.max(0, progress))}
        aria-label={`Progresso do patrimônio atual até a ${goalLabel}`}
        aria-valuetext={
          hideValues ? "***" : `${progress.toFixed(0)}% da ${goalLabel}`
        }
        sx={{
          height: 14,
          borderRadius: "4px",
          backgroundColor: getColor(Colors.neutral600),
          "& .MuiLinearProgress-bar": {
            backgroundColor: getColor(
              hideValues
                ? Colors.neutral600
                : progress >= 100
                  ? Colors.brand
                  : Colors.danger200,
            ),
            borderRadius: "4px",
          },
        }}
      />
      <Text
        aria-hidden
        style={{ fontSize: 14 }}
        size={FontSizes.EXTRA_SMALL}
        weight={FontWeights.SEMI_BOLD}
        color={Colors.neutral0}
        extraStyle={{
          position: "absolute",
          top: "50%",
          right: 6,
          transform: "translateY(-50%)",
          lineHeight: 1,
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
        }}
      >
        {hideValues ? "***" : `${progress.toFixed(0)}%`}
      </Text>
    </Box>
  </Tooltip>
);

export const ScenarioToggles = ({
  visible,
  onChange,
}: {
  visible: PercentileVisibility;
  onChange: (key: PercentileKey, checked: boolean) => void;
}) => {
  const onlyOne = Object.values(visible).filter(Boolean).length === 1;
  return (
    <Stack direction="row" flexWrap="wrap">
      {(Object.keys(PERCENTILES) as PercentileKey[]).map((key) => (
        <FormControlLabel
          key={key}
          label={PERCENTILES[key].toggle}
          control={
            <Checkbox
              checked={visible[key]}
              disabled={onlyOne && visible[key]}
              onChange={(_, checked) => onChange(key, checked)}
            />
          }
        />
      ))}
    </Stack>
  );
};

export const ScenarioTable = ({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel?: string;
}) => (
  <Box
    component="table"
    aria-label={ariaLabel}
    sx={{
      width: "100%",
      borderCollapse: "collapse",
      "& th, & td": {
        borderBottom: `1px solid ${getColor(Colors.neutral600)}`,
        py: 1,
        px: 1,
        textAlign: "left",
        fontSize: 12,
      },
      "& th": { color: getColor(Colors.neutral300), fontWeight: 700 },
      "& td": { color: getColor(Colors.neutral200) },
    }}
  >
    {children}
  </Box>
);

export const ChartTooltipBox = ({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
}) => (
  <Stack
    spacing={0.5}
    sx={{
      border: "1px solid",
      p: 1,
      borderColor: getColor(Colors.brand400),
      backgroundColor: getColor(Colors.neutral600),
      ...sx,
    }}
  >
    {children}
  </Stack>
);

export const PercentileTrajectoryChart = <T extends object>({
  title = "Aposentadoria · trajetória do patrimônio no cenário atual",
  subtitle,
  headerAction,
  fullscreenControls,
  expandable = false,
  chartOverlay,
  data,
  xKey,
  dataKeys,
  visible,
  tooltip,
  hideValues,
}: {
  title?: ReactNode;
  subtitle: ReactNode;
  headerAction?: ReactNode;
  fullscreenControls?: ReactNode;
  expandable?: boolean;
  chartOverlay?: {
    axis: ReactNode;
    behindLines: ReactNode;
    aboveLines?: ReactNode;
  };
  data: T[];
  xKey: string;
  dataKeys: Record<PercentileKey, string>;
  visible: PercentileVisibility;
  tooltip: ReactElement;
  hideValues: boolean;
}) => (
  <ChartFrame
    title={title}
    subtitle={subtitle}
    headerAction={headerAction}
    fullscreenControls={fullscreenControls}
    expandable={expandable}
    height={220}
    chart={
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="5" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={getColor(Colors.neutral0)}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <YAxis
          stroke={getColor(Colors.brand400)}
          tick={chartOverlay ? { fill: getColor(Colors.brand400) } : undefined}
          tickLine={false}
          axisLine={false}
          tickFormatter={compactNumberTick}
          tickCount={hideValues ? 0 : undefined}
        />
        {chartOverlay?.axis}
        <RechartsTooltip cursor={false} content={tooltip} />
        {chartOverlay?.behindLines}
        {(["p10", "p50", "p90"] as const)
          .filter((key) => visible[key])
          .map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={dataKeys[key]}
              stroke={percentileColor(key)}
              strokeWidth={PERCENTILES[key].width}
              strokeDasharray={PERCENTILES[key].dash}
              dot={false}
              name={PERCENTILES[key].line}
            />
          ))}
        {chartOverlay?.aboveLines}
      </ComposedChart>
    }
  />
);
