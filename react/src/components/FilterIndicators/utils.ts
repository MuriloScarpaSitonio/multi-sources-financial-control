import type { ActiveFilter, FilterFieldConfigs } from "./types";

// Check if a value matches its default
const isValueDefault = (value: any, defaultValue: any): boolean => {
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    // For arrays, check if they contain the same elements
    if (value.length !== defaultValue.length) return false;
    return value.every((v) => defaultValue.includes(v));
  }
  return value === defaultValue;
};

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

    if (Array.isArray(value)) {
      if (value.length > 0) {
        // For array filters, check if this specific value is in the default array
        const defaultArray = Array.isArray(defaultValue) ? defaultValue : [];
        value.forEach((v) => {
          const displayValue = config.valueMapping?.[v] ?? v;
          activeFilters.push({
            key,
            label: config.label,
            value: v,
            displayValue,
            isDefault: defaultArray.includes(v),
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
        isDefault: value === defaultValue,
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
