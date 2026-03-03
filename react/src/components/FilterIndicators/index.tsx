import { useMemo } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { Colors, getColor } from "../../design-system";
import FilterChip from "./FilterChip";
import { computeActiveFilters, removeFilter } from "./utils";
import type { ActiveFilter, FilterIndicatorsProps } from "./types";

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("pt-BR");
};

const FilterIndicators = <T extends Record<string, any>>({
  filters,
  setFilters,
  defaultFilters,
  fieldConfigs,
  dateFilters,
}: FilterIndicatorsProps<T>) => {
  const activeFilters = useMemo(
    () => computeActiveFilters(filters, defaultFilters, fieldConfigs),
    [filters, defaultFilters, fieldConfigs]
  );

  const activeDateFilters = useMemo(() => {
    if (!dateFilters) return [];

    const { startDate, endDate, defaultStartDate, defaultEndDate } = dateFilters;

    // Check if dates match their defaults (compare by date string to avoid time issues)
    const isStartDateDefault =
      formatDate(startDate) === formatDate(defaultStartDate);
    const isEndDateDefault =
      formatDate(endDate) === formatDate(defaultEndDate);

    return [
      {
        key: "startDate",
        label: "Início",
        value: startDate.toISOString(),
        displayValue: formatDate(startDate),
        isDefault: isStartDateDefault,
      },
      {
        key: "endDate",
        label: "Fim",
        value: endDate.toISOString(),
        displayValue: formatDate(endDate),
        isDefault: isEndDateDefault,
      },
    ];
  }, [dateFilters]);

  const allActiveFilters = [...activeDateFilters, ...activeFilters];

  // Count filters that are not at their default values
  const nonDefaultFiltersCount = allActiveFilters.filter(
    (filter) => !filter.isDefault
  ).length;

  const handleDeleteFilter = (filterToRemove: ActiveFilter) => {
    if (filterToRemove.key === "startDate" && dateFilters) {
      dateFilters.setStartDate(dateFilters.defaultStartDate);
      return;
    }
    if (filterToRemove.key === "endDate" && dateFilters) {
      dateFilters.setEndDate(dateFilters.defaultEndDate);
      return;
    }

    setFilters((currentFilters) =>
      removeFilter(currentFilters, defaultFilters, filterToRemove)
    );
  };

  const handleClearAll = () => {
    setFilters(defaultFilters);
    if (dateFilters) {
      dateFilters.setStartDate(dateFilters.defaultStartDate);
      dateFilters.setEndDate(dateFilters.defaultEndDate);
    }
  };

  if (allActiveFilters.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        backgroundColor: getColor(Colors.neutral900),
        px: 2,
        pb: 2,
      }}
    >
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {allActiveFilters.map((filter, index) => (
          <FilterChip
            key={`${filter.key}-${filter.value}-${index}`}
            filter={filter}
            onDelete={handleDeleteFilter}
          />
        ))}
        {nonDefaultFiltersCount >= 2 && (
          <Button
            variant="text"
            size="small"
            onClick={handleClearAll}
            sx={{
              textTransform: "none",
              color: getColor(Colors.neutral300),
              "&:hover": {
                color: getColor(Colors.neutral0),
              },
            }}
          >
            Limpar filtros
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default FilterIndicators;
export type { FilterFieldConfig, FilterFieldConfigs, DateFilterProps } from "./types";
