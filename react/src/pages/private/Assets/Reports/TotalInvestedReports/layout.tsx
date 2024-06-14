import { styled } from "@mui/system";
import { Tabs as BaseTabs } from "@mui/base/Tabs";
import { TabsList as BaseTabsList } from "@mui/base/TabsList";
import { TabPanel as BaseTabPanel } from "@mui/base/TabPanel";
import { Tab as BaseTab, tabClasses } from "@mui/base/Tab";

import { Colors, getColor } from "../../../../../design-system";

export const Tab = styled(BaseTab)`
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  background-color: ${getColor(Colors.neutral900)};
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 5px;
  display: flex;

  &:hover {
    background-color: ${getColor(Colors.brand900)};
  }

  &.${tabClasses.selected} {
    background-color: ${getColor(Colors.brand800)};
  }
`;

export const TabPanel = styled(BaseTabPanel)`
  width: 100%;
  font-size: 0.875rem;
`;

export const Tabs = styled(BaseTabs)`
  display: flex;
  gap: 16px;
  width: 110%;
`;

export const TabsList = styled(BaseTabsList)`
  min-width: 100px;
  display: flex;
  gap: 8px;
  flex-direction: column;
  align-items: center;
  align-content: space-between;
`;
