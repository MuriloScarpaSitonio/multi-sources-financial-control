import type { ReactNode } from "react";
import type { SxProps } from "@mui/material";

import Box from "@mui/material/Box";
import { getColor } from "../utils";
import { Colors } from "../enums";

const ReportBox = ({ sx, children }: { sx?: SxProps; children: ReactNode }) => (
  <Box
    sx={{
      backgroundColor: getColor(Colors.neutral900),
      borderRadius: 3, // 12px
      ...sx,
    }}
  >
    {children}
  </Box>
);
export default ReportBox;
