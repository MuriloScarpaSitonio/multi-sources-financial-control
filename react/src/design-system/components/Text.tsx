import { ReactNode } from "react";

import Typography from "@mui/material/Typography";

import * as enums from "../enums";
import { COLORS, FONT_WEIGHTS, FONT_SIZES } from "../maps";
import { getColor, getFontSize, getFontWeight } from "../utils";
import { CSSProperties } from "@mui/styles";

const Text = ({
  children,
  weight = enums.FontWeights.MEDIUM,
  size = enums.FontSizes.MEDIUM,
  color = enums.Colors.neutral0,
  extraStyle = {},
  ...props
}: {
  children: ReactNode;
  weight?: keyof typeof FONT_WEIGHTS;
  size?: keyof typeof FONT_SIZES;
  color?: keyof typeof COLORS;
  extraStyle?: CSSProperties;
  [extra: string | number]: any;
}) => (
  <Typography
    {...props}
    style={{
      ...extraStyle,
      fontWeight: getFontWeight(weight),
      fontSize: getFontSize(size),
      color: getColor(color),
    }}
  >
    {children}
  </Typography>
);

export default Text;
