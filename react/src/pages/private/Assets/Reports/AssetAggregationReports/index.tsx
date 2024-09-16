import { useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import ReportBox from "../../../../../design-system/components/ReportBox";
import ReportTabs from "../../../../../design-system/components/ReportTabs";
import { StyledTab, StyledTabs, StyledTabsList } from "./layout";
import { GroupBy, Kinds, ReportUnknownAggregationData } from "../types";
import {
  PieChart,
  HorizontalBarChart,
  HorizontalPositiveNegativeBarChart,
} from "./charts";
import { useAssetsReports } from "./hooks";

const PercentageContent = ({
  groupBy,
  data,
  checked,
  onSwitchChange,
}: {
  groupBy: GroupBy;
  data: ReportUnknownAggregationData;
  checked: boolean;
  onSwitchChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => void;
}) => {
  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1 }}>
      <Stack direction="row" justifyContent="flex-end">
        <FormControlLabel
          control={<Switch checked={checked} onChange={onSwitchChange} />}
          label="Preços atualizados"
        />
      </Stack>
      <PieChart data={data} groupBy={groupBy} />
    </Stack>
  );
};

const TotalInvestedContent = ({
  groupBy,
  data,
  checked,
  onSwitchChange,
}: {
  groupBy: GroupBy;
  data: ReportUnknownAggregationData;
  checked: boolean;
  onSwitchChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => void;
}) => {
  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <FormControlLabel
          control={<Switch checked={checked} onChange={onSwitchChange} />}
          label="Preços atualizados"
        />
      </Stack>
      <HorizontalBarChart data={data} groupBy={groupBy} />
    </Stack>
  );
};

const RoiContent = ({
  groupBy,
  data,
  opened,
  closed,
  onOpenedCheckbocChange,
  onClosedCheckbocChange,
}: {
  groupBy: GroupBy;
  data: ReportUnknownAggregationData;
  opened: boolean;
  closed: boolean;
  onOpenedCheckbocChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => void;
  onClosedCheckbocChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => void;
}) => {
  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <FormControlLabel
          control={
            <Checkbox
              checked={opened}
              onChange={onOpenedCheckbocChange}
              disabled={!closed}
            />
          }
          label="Ativos abertos"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={closed}
              onChange={onClosedCheckbocChange}
              disabled={!opened}
            />
          }
          label="Ativos fechados"
        />
      </Stack>
      <HorizontalPositiveNegativeBarChart data={data} groupBy={groupBy} />
    </Stack>
  );
};

const Content = ({ groupBy, kind }: { groupBy: GroupBy; kind: Kinds }) => {
  const [current, setCurrent] = useState(false);
  const [opened, setOpened] = useState(true);
  const [closed, setClosed] = useState(true);

  const percentage = kind === Kinds.TOTAL_INVESTED_PERCENTAGE;
  const {
    data,
    // isPending TODO
  } = useAssetsReports({
    group_by: groupBy,
    kind: percentage ? Kinds.TOTAL_INVESTED : kind,
    percentage,
    opened,
    closed,
    current,
  });

  if (percentage)
    return (
      <PercentageContent
        data={data as ReportUnknownAggregationData}
        groupBy={groupBy}
        checked={current}
        onSwitchChange={(_, checked) => setCurrent(checked)}
      />
    );
  if (kind === Kinds.TOTAL_INVESTED)
    return (
      <TotalInvestedContent
        data={data as ReportUnknownAggregationData}
        groupBy={groupBy}
        checked={current}
        onSwitchChange={(_, checked) => setCurrent(checked)}
      />
    );
  return (
    <RoiContent
      data={data as ReportUnknownAggregationData}
      groupBy={groupBy}
      opened={opened}
      onOpenedCheckbocChange={(_, checked) => setOpened(checked)}
      closed={closed}
      onClosedCheckbocChange={(_, checked) => setClosed(checked)}
    />
  );
};

const GroupByTabsWithContent = ({ kind }: { kind: Kinds }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.TYPE);
  return (
    <StyledTabs
      defaultValue={0}
      onChange={(_, newValue) => {
        switch (newValue) {
          case 0:
            setGroupBy(GroupBy.TYPE);
            break;
          case 1:
            setGroupBy(GroupBy.SECTOR);
            break;
          case 2:
            setGroupBy(GroupBy.OBJECTIVE);
            break;
          default:
            break;
        }
      }}
    >
      <StyledTabsList>
        <StyledTab>Categorias</StyledTab>
        <StyledTab>Setores</StyledTab>
        <StyledTab>Objetivos</StyledTab>
      </StyledTabsList>
      <TabPanel value={0}>
        <Content groupBy={groupBy} kind={kind} />
      </TabPanel>
      <TabPanel value={1}>
        <Content groupBy={groupBy} kind={kind} />
      </TabPanel>
      <TabPanel value={2}>
        <Content groupBy={groupBy} kind={kind} />
      </TabPanel>
    </StyledTabs>
  );
};

const AssetAggregationReports = () => {
  const [kind, setKind] = useState<Kinds>(Kinds.TOTAL_INVESTED_PERCENTAGE);
  const [tabValue, setTabValue] = useState(0);

  return (
    <ReportBox>
      <ReportTabs
        value={tabValue}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setKind(Kinds.TOTAL_INVESTED_PERCENTAGE);
              setTabValue(newValue);
              break;
            case 1:
              setKind(Kinds.TOTAL_INVESTED);
              setTabValue(newValue);
              break;
            case 2:
              setKind(Kinds.ROI);
              setTabValue(newValue);
              break;
            default:
              break;
          }
        }}
      >
        <Tab label="Percentual" />
        <Tab label="Valor investido" />
        <Tab label="ROI (Lucro/Prejuízo)" />
      </ReportTabs>
      <GroupByTabsWithContent kind={kind} />
    </ReportBox>
  );
};

export default AssetAggregationReports;
