import type { Dispatch, SetStateAction } from "react";

export type FilterFieldConfig = {
  label: string;
  valueMapping?: Record<string, string>;
};

export type FilterFieldConfigs = Record<string, FilterFieldConfig>;

export type ActiveFilter = {
  key: string;
  label: string;
  value: string;
  displayValue: string;
  isDefault?: boolean;
};

export type DateFilterProps = {
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  endDate: Date;
  setEndDate: Dispatch<SetStateAction<Date>>;
  defaultStartDate: Date;
  defaultEndDate: Date;
};

export type FilterIndicatorsProps<T extends Record<string, any>> = {
  filters: T;
  setFilters: Dispatch<SetStateAction<T>>;
  defaultFilters: T;
  fieldConfigs: FilterFieldConfigs;
  dateFilters?: DateFilterProps;
};
