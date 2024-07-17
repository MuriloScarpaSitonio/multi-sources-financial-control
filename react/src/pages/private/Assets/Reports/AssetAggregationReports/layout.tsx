import { styled } from "@mui/system";
import { Tabs as BaseTabs } from "@mui/base/Tabs";
import { Tab as BaseTab, tabClasses } from "@mui/base/Tab";
import { TabsList as BaseTabsList } from "@mui/base/TabsList";

import {
  Colors,
  FontSizes,
  getColor,
  getFontSize,
} from "../../../../../design-system";

export const StyledTab = styled(BaseTab)`
  display: flex;
  padding: 10px 16px;
  gap: 8px;
  cursor: pointer;
  font-size: ${getFontSize(FontSizes.EXTRA_SMALL)}px;
  background-color: ${getColor(Colors.neutral400)};
  color: ${getColor(Colors.neutral0)};
  border: none;
  border-radius: 0px 8px 8px 0px;

  &:hover {
    background-color: ${getColor(Colors.neutral200)};
    color: ${getColor(Colors.neutral800)};
  }

  &.${tabClasses.selected} {
    background-color: ${getColor(Colors.neutral300)};
    color: ${getColor(Colors.neutral800)};
  }
`;

// export const TabPanel = styled(BaseTabPanel)`
//   width: 100%;
// `;

export const StyledTabs = styled(BaseTabs)`
  display: flex;
`;

export const StyledTabsList = styled(BaseTabsList)`
  min-width: 100px;
  display: flex;
  gap: 16px;
  flex-direction: column;
  margin-top: 16px;
`;
