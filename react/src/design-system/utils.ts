import { isEqual } from "date-fns";

import { COLORS, FONT_SIZES, FONT_WEIGHTS } from "./maps";

export const getColor = (color: keyof typeof COLORS) => COLORS[color];
export const getFontSize = (size: keyof typeof FONT_SIZES) => FONT_SIZES[size];
export const getFontWeight = (weight: keyof typeof FONT_WEIGHTS) =>
  FONT_WEIGHTS[weight];

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
