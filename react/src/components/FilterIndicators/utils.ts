import type { ActiveFilter, FilterFieldConfigs } from "./types";

export const computeActiveFilters = <T extends Record<string, any>>(
  filters: T,
  defaultFilters: T,
  fieldConfigs: FilterFieldConfigs
): ActiveFilter[] => {
  const activeFilters: ActiveFilter[] = [];

  Object.keys(filters).forEach((key) => {
    const value = filters[key];
    const defaultValue = defaultFilters[key];
    const config = fieldConfigs[key];

    if (!config) return;

    const isDefaultField = key in defaultFilters;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        value.forEach((v) => {
          const displayValue = config.valueMapping?.[v] ?? v;
          activeFilters.push({
            key,
            label: config.label,
            value: v,
            displayValue,
            isDefault: isDefaultField,
          });
        });
      }
    } else if (value !== undefined && value !== null && value !== "") {
      const displayValue = config.valueMapping?.[value] ?? String(value);
      activeFilters.push({
        key,
        label: config.label,
        value,
        displayValue,
        isDefault: isDefaultField,
      });
    }
  });

  return activeFilters;
};

export const removeFilter = <T extends Record<string, any>>(
  filters: T,
  defaultFilters: T,
  filterToRemove: ActiveFilter
): T => {
  const key = filterToRemove.key;
  const currentValue = filters[key];
  const defaultValue = defaultFilters[key];

  if (Array.isArray(currentValue)) {
    const newValue = currentValue.filter((v) => v !== filterToRemove.value);
    return {
      ...filters,
      [key]: newValue.length > 0 ? newValue : defaultValue || [],
    };
  }

  return {
    ...filters,
    [key]: defaultValue,
  };
};
