import { isEqual } from "date-fns";

export const isFilteringWholeMonth = (startDate: Date, endDate: Date) =>
  isEqual(
    // is the selected date the first day of month?
    new Date(endDate.getFullYear(), endDate.getMonth(), 1),
    startDate,
  ) &&
  isEqual(
    // is the selected date the last day of month?
    new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0),
    endDate,
  );
