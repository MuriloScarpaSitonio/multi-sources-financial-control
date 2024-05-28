import { COLORS, FONT_SIZES, FONT_WEIGHTS } from "./maps";

export const getColor = (color: keyof typeof COLORS) => COLORS[color];
export const getFontSize = (size: keyof typeof FONT_SIZES) => FONT_SIZES[size];
export const getFontWeight = (weight: keyof typeof FONT_WEIGHTS) =>
  FONT_WEIGHTS[weight];
