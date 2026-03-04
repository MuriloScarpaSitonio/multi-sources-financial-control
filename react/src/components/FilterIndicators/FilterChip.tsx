import Chip from "@mui/material/Chip";
import CloseIcon from "@mui/icons-material/Close";

import type { ActiveFilter } from "./types";

type FilterChipProps = {
  filter: ActiveFilter;
  onDelete: (filter: ActiveFilter) => void;
};

const FilterChip = ({ filter, onDelete }: FilterChipProps) => {
  return (
    <Chip
      label={`${filter.label}: ${filter.displayValue}`}
      onDelete={filter.isDefault ? undefined : () => onDelete(filter)}
      deleteIcon={filter.isDefault ? undefined : <CloseIcon />}
      size="small"
      sx={{
        borderRadius: "6px",
        "& .MuiChip-deleteIcon": {
          fontSize: "16px",
        },
      }}
    />
  );
};

export default FilterChip;
