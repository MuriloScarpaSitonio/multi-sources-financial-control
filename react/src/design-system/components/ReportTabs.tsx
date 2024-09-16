import type { ReactNode } from "react";

import Tabs from "@mui/material/Tabs";
import { TabsOwnProps } from "@mui/material/Tabs";

import { getColor } from "../utils";
import { Colors } from "../enums";

interface TabsProps extends TabsOwnProps {
  children: ReactNode;
}

const ReportTabs = ({ children, ...rest }: TabsProps) => (
  <Tabs
    centered
    sx={{
      backgroundColor: getColor(Colors.neutral700),
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    }}
    TabIndicatorProps={{
      sx: { background: getColor(Colors.neutral0), height: "1.5px" },
    }}
    textColor="inherit"
    defaultValue={0}
    {...rest}
  >
    {children}
  </Tabs>
);

export default ReportTabs;
