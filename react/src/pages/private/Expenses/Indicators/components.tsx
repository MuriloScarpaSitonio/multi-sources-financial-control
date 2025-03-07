import type { ReactNode } from "react";

import Box from "@mui/material/Box";

import { Colors, getColor } from "../../../../design-system";

export const IndicatorBox = ({
  children,
  variant,
  width,
  height,
}: {
  children: ReactNode;
  variant: "success" | "danger";
  width: string;
  height?: string;
}) => (
  <Box
    sx={{
      p: 2,
      borderRadius: "10px",
      border: `2px solid ${variant === "success" ? getColor(Colors.brand) : getColor(Colors.danger200)}`,
      width,
      height,
    }}
  >
    {children}
  </Box>
);
