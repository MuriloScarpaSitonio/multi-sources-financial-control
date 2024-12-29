import { useContext, useMemo, useState } from "react";

import { TabPanel } from "@mui/base/TabPanel";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";

import {
  DatePickers,
  FontSizes,
  ReportBox,
  ReportTabs,
  StyledTab,
  StyledTabs,
  StyledTabsList,
  Text,
} from "../../../../design-system";
import {
  GroupBy,
  HistoricReportResponse,
  ReportAggregatedByCategoryDataItem,
} from "../../Expenses/types";
import {
  BarChartWithReferenceLine,
  PieChart,
} from "../../Expenses/Reports/charts";
import {
  useRevenuesHistoricReport,
  useRevenuesPercentagenReport,
} from "./hooks";
import { ExpensesContext } from "../../Expenses/context";

enum Kinds {
  PERCENTAGE,
  HISTORIC,
}

const HistoricContent = () => {
  const [oneYearAgo, threeMonthsInTheFuture] = useMemo(() => {
    const _oneYearAgo = new Date();
    _oneYearAgo.setFullYear(_oneYearAgo.getFullYear() - 1);

    const _threeMonthsInTheFuture = new Date();
    _threeMonthsInTheFuture.setMonth(_threeMonthsInTheFuture.getMonth() + 4);
    return [_oneYearAgo, _threeMonthsInTheFuture];
  }, []);

  const [startDate, setStartDate] = useState(oneYearAgo);
  const [endDate, setEndDate] = useState(threeMonthsInTheFuture);
  const {
    data,
    // isPending TODO
  } = useRevenuesHistoricReport({ startDate, endDate });

  return (
    <Stack gap={1} justifyContent="center" sx={{ pt: 2, pb: 1, pl: 2.5 }}>
      <DatePickers
        views={["month", "year"]}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
      <BarChartWithReferenceLine
        data={data?.historic as HistoricReportResponse["historic"]}
        referenceValue={data?.avg as HistoricReportResponse["avg"]}
        variant="success"
      />
    </Stack>
  );
};
const PercentageContent = () => {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    revenuesCategories: { hexColorMapping: colors },
  } = useContext(ExpensesContext);

  const { data, isPending } = useRevenuesPercentagenReport({
    startDate,
    endDate,
  });

  return (
    <Stack justifyContent="center" sx={{ py: 1, pl: 2.5 }}>
      <DatePickers
        views={["day", "month", "year"]}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
      {!!data?.length ? (
        <PieChart
          data={data as ReportAggregatedByCategoryDataItem[]}
          groupBy={GroupBy.CATEGORY}
          colors={colors}
        />
      ) : (
        <Box sx={{ py: 18, pl: 15, mr: 25 }}>
          {isPending ? (
            <></>
          ) : (
            <Text size={FontSizes.SEMI_REGULAR}>
              Nenhuma receita encontrada
            </Text>
          )}
        </Box>
      )}
    </Stack>
  );
};
const TabsWithContent = () => (
  <StyledTabs defaultValue={0}>
    <StyledTabsList>
      <StyledTab>Categorias</StyledTab>
    </StyledTabsList>
    <TabPanel value={0}>
      <PercentageContent />
    </TabPanel>
  </StyledTabs>
);

const Content = ({ kind }: { kind: Kinds }) => {
  if (kind === Kinds.HISTORIC) return <HistoricContent />;
  return <TabsWithContent />;
};

const RevenueReports = () => {
  const [kind, setKind] = useState<Kinds>(Kinds.PERCENTAGE);
  const [tabValue, setTabValue] = useState(0);

  return (
    <ReportBox>
      <ReportTabs
        value={tabValue}
        onChange={(_, newValue) => {
          switch (newValue) {
            case 0:
              setKind(Kinds.PERCENTAGE);
              setTabValue(newValue);
              break;
            case 1:
              setKind(Kinds.HISTORIC);
              setTabValue(newValue);
              break;
            default:
              break;
          }
        }}
      >
        <Tab label="Percentual" />
        <Tab label="Histórico" />
      </ReportTabs>
      <Content kind={kind} />
    </ReportBox>
  );
};

export default RevenueReports;