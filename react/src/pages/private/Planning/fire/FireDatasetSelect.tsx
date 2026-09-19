import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ListSubheader from "@mui/material/ListSubheader";
import {
  Colors,
  FontSizes,
  getColor,
  getFontSize,
} from "../../../../design-system";
import type { FireReturnSeriesKey } from "../../Home/fireReturnTypes";
import {
  DATASET_GROUPS,
  DATASET_LABELS,
  datasetPeriodLabel,
} from "./fireHistoricalDatasets";
const FireDatasetSelect = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FireReturnSeriesKey | "";
  onChange: (value: FireReturnSeriesKey) => void;
}) => (
  <Select
    size="small"
    fullWidth
    displayEmpty
    value={value}
    inputProps={{ "aria-label": label }}
    onChange={(event) => onChange(event.target.value as FireReturnSeriesKey)}
    renderValue={(selected) =>
      selected ? DATASET_LABELS[selected] : "Selecionar índice"
    }
    sx={{
      fontSize: getFontSize(FontSizes.EXTRA_SMALL),
      "& .MuiSelect-select": { py: 0.75 },
      "& fieldset": { borderColor: getColor(Colors.neutral600) },
      "&.Mui-focused fieldset": { borderColor: getColor(Colors.brand200) },
    }}
    MenuProps={{
      slotProps: { paper: { sx: { maxWidth: "calc(100vw - 32px)" } } },
    }}
  >
    {DATASET_GROUPS.flatMap((group) => [
      <ListSubheader
        key={`group-${group.label}`}
        sx={{
          fontSize: getFontSize(FontSizes.EXTRA_SMALL),
          color: getColor(Colors.neutral300),
          backgroundColor: getColor(Colors.neutral800),
          lineHeight: "28px",
        }}
      >
        {group.label}
      </ListSubheader>,
      ...group.datasets.map((dataset) => (
        <MenuItem
          key={dataset}
          value={dataset}
          sx={{
            fontSize: getFontSize(FontSizes.EXTRA_SMALL),
            whiteSpace: "normal",
            pl: 3,
          }}
        >
          {DATASET_LABELS[dataset]} · {datasetPeriodLabel(dataset)}
        </MenuItem>
      )),
    ])}
  </Select>
);
export default FireDatasetSelect;
