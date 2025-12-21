import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";

export type ChartType = "bar" | "line";

type ChartTypeToggleProps = {
  value: ChartType;
  onChange: (value: ChartType) => void;
};

const ChartTypeToggle = ({ value, onChange }: ChartTypeToggleProps) => (
  <ToggleButtonGroup
    value={value}
    exclusive
    onChange={(_, newValue) => {
      if (newValue !== null) {
        onChange(newValue);
      }
    }}
    size="small"
  >
    <ToggleButton value="bar" aria-label="bar chart">
      <BarChartIcon fontSize="small" />
    </ToggleButton>
    <ToggleButton value="line" aria-label="line chart">
      <ShowChartIcon fontSize="small" />
    </ToggleButton>
  </ToggleButtonGroup>
);

export default ChartTypeToggle;

