import { useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";

import { Colors, getColor } from "../../../../design-system";
import {
  StyledTab,
  StyledTabs,
  StyledTabsList,
} from "../../../../design-system/components/Tabs";
import {
  GroupBy,
  Kinds,
  PercentagePeriods,
  ReportUnknownAggregationData,
} from "../types";
import { HorizontalStackedBarChart, PieChart } from "./charts";
import {
  useExpensesAvgComparasionReport,
  useExpensesPercentagenReport,
} from "./hooks";

const PercentageContent = ({ groupBy }: { groupBy: GroupBy }) => {
  const [period, setPeriod] = useState<PercentagePeriods>("current");
  const {
    data,
    // isPending TODO
  } = useExpensesPercentagenReport({
    group_by: groupBy,
    period,
  });

  return (
    <Stack justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PercentagePeriods)}
        >
          <MenuItem value="current">Mês atual</MenuItem>
          <MenuItem value="since_a_year_ago">Um ano atrás</MenuItem>
          <MenuItem value="current_month_and_past">Todo o período</MenuItem>
        </Select>
      </Stack>
      <PieChart data={data as ReportUnknownAggregationData} groupBy={groupBy} />
    </Stack>
  );
};

const CurrentWithAvgComparasionContent = ({
  groupBy,
}: {
  groupBy: GroupBy;
}) => {
  const [allPeriod, setAllPeriod] = useState(false);
  const {
    data,
    // isPending TODO
  } = useExpensesAvgComparasionReport({
    group_by: groupBy,
    period: allPeriod ? "current_month_and_past" : "since_a_year_ago",
  });

  return (
    <Stack gap={1} justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <Stack direction="row" justifyContent="flex-end">
        <FormControlLabel
          control={
            <Switch
              checked={allPeriod}
              onChange={(_, checked) => setAllPeriod(checked)}
            />
          }
          label="Todo o período"
        />
      </Stack>
      <HorizontalStackedBarChart
        data={data as ReportUnknownAggregationData}
        groupBy={groupBy}
      />
    </Stack>
  );
};

const Content = ({ groupBy, kind }: { groupBy: GroupBy; kind: Kinds }) => {
  if (kind === Kinds.PERCENTAGE) return <PercentageContent groupBy={groupBy} />;

  return <CurrentWithAvgComparasionContent groupBy={groupBy} />;
};

const GroupByTabsWithContent = ({ kind }: { kind: Kinds }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(GroupBy.CATEGORY);
  return (
    <StyledTabs
      defaultValue={0}
      onChange={(_, newValue) => {
        switch (newValue) {
          case 0:
            setGroupBy(GroupBy.CATEGORY);
            break;
          case 1:
            setGroupBy(GroupBy.SOURCE);
            break;
          case 2:
            setGroupBy(GroupBy.TYPE);
            break;
          default:
            break;
        }
      }}
    >
      <StyledTabsList>
        <StyledTab>Categorias</StyledTab>
        <StyledTab>Fontes</StyledTab>
        <StyledTab>Tipos</StyledTab>
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

const ExpenseReports = () => {
  const [kind, setKind] = useState<Kinds>(Kinds.TOTAL_SPENT);
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box
      sx={{
        backgroundColor: getColor(Colors.neutral900),
        borderRadius: 6, // 24px
      }}
    >
      <Tabs
        value={tabValue}
        centered
        sx={{
          backgroundColor: getColor(Colors.neutral700),
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        TabIndicatorProps={{
          sx: { background: getColor(Colors.neutral0), height: "1.5px" },
        }}
        textColor="inherit"
        defaultValue={0}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setKind(Kinds.TOTAL_SPENT);
              setTabValue(newValue);
              break;

            case 1:
              setKind(Kinds.PERCENTAGE);
              setTabValue(newValue);
              break;
            default:
              break;
          }
        }}
      >
        <Tab label="Valor gasto" />
        <Tab label="Percentual" />
      </Tabs>
      <GroupByTabsWithContent kind={kind} />
    </Box>
  );
};

export default ExpenseReports;
