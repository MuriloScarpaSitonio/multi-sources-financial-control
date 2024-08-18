import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  //Line,
  //LineChart,
  ReferenceLine,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { Loader } from "../Loaders";
import { ExpensesApi } from "../../api";
import { makeStyles } from "@mui/styles";

const chartWidth = 950;
const chartHeight = 300;
const chartBarSize = 20;
const lastDataFillCollor = "rgba(54, 162, 235, 0.3)";
const currentDataFillColor = "rgba(54, 162, 235, 1)";

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    display: "flex",
  },
  tabs: {
    // borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
      style={{ position: "relative" }}
    >
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

const ExpenseHorizontalMultipleBarChart = ({ data, dataKey }) => (
  <BarChart
    width={chartWidth}
    height={chartHeight}
    data={data}
    layout="vertical"
    margin={{ left: 55 }}
    barGap={-30}
  >
    <CartesianGrid stroke="#eee" />
    <XAxis
      type="number"
      tickFormatter={(t) => `R$ ${t.toLocaleString("pt-br")}`}
    />
    {/* minTickGap is required in order to show all labels. Default is 5  */}
    <YAxis minTickGap={2} type="category" dataKey={dataKey} yAxisId={0} />
    <YAxis type="category" dataKey={dataKey} yAxisId={1} hide />
    <ChartTooltip
      cursor={{ fill: "#f5f5f5" }}
      separator=": "
      formatter={(value, name) => [
        `R$ ${value.toLocaleString("pt-br")}`,
        name === "avg" ? "Média" : "Mês atual",
      ]}
      labelFormatter={(_) => ""}
      payload
    />
    <Legend formatter={(value) => (value === "avg" ? "Média" : "Mês atual")} />
    <Bar
      dataKey={"avg"}
      barSize={dataKey === "category" ? chartBarSize : chartBarSize * 2}
      yAxisId={0}
      fill={lastDataFillCollor}
    />
    <Bar
      dataKey={"total"}
      barSize={dataKey === "category" ? chartBarSize / 2 : chartBarSize}
      yAxisId={1}
      fill={currentDataFillColor}
    />
  </BarChart>
);

function getTabProps(index) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

const ExpenseBarChartComponent = ({ data, dataKey, fetchReportData }) => {
  const COMPARATIVE_REPORT_TEXT = "Mês atual X Média dos últimos 12 meses";
  const ALL_TIME_REPORT_TEXT = "Todo o período";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(COMPARATIVE_REPORT_TEXT);
  const [menuText, setMenuText] = useState(ALL_TIME_REPORT_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    // we haven't changed it yet
    menuText === COMPARATIVE_REPORT_TEXT
      ? fetchReportData(dataKey, { period: "since_a_year_ago" })
      : fetchReportData(dataKey, { period: "current_month_and_past" });

    setButtonText(menuText);
    setMenuText(buttonText);
    setAnchorEl(null);
  };

  return (
    <Card elevation={6}>
      <CardHeader
        action={
          <>
            <Button
              endIcon={<ArrowDropDownIcon />}
              size="small"
              variant="text"
              aria-controls="basic-menu"
              aria-haspopup="true"
              onClick={handleClick}
            >
              {buttonText}
            </Button>
            <Menu
              id="basic-menu"
              keepMounted
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
              transformOrigin={{ vertical: "top", horizontal: "center" }}
              getContentAnchorEl={null}
            >
              <MenuItem onClick={handleClose}>{menuText}</MenuItem>
            </Menu>
          </>
        }
      />
      <Divider />
      <CardContent>
        <ExpenseHorizontalMultipleBarChart data={data} dataKey={dataKey} />
      </CardContent>
    </Card>
  );
};

const ExpenseHistoricChartComponent = ({ data, future }) => {
  return (
    <Card elevation={6}>
      <CardContent>
        <BarChart width={chartWidth} height={chartHeight} data={data.historic}>
          <CartesianGrid stroke="#eee" />
          <XAxis dataKey="month" />
          <YAxis />
          <ChartTooltip
            cursor={{ fill: "#f5f5f5" }}
            separator=": "
            formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
            labelFormatter={(_) => ""}
          />
          <Bar dataKey="total" fill={currentDataFillColor} />
          {!future && (
            <ReferenceLine
              y={data.avg}
              label="Média"
              stroke="#e65100"
              strokeDasharray="3 3"
            />
          )}
        </BarChart>
      </CardContent>
    </Card>
  );
};

export const ExpensesReports = () => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  //const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  let api = new ExpensesApi();
  const classes = useStyles();

  function fetchHistoricData(filters = {}) {
    setIsLoaded(false);
    api
      .historic(filters)
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  function fetchReportData(kind, filters = {}) {
    setIsLoaded(false);
    api
      .report(kind, filters)
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  useEffect(() => fetchHistoricData({ future: false }), []);

  const handleTabsChange = (event, newValue) => {
    switch (newValue) {
      case 0:
        fetchHistoricData({ future: false });
        break;
      case 1:
        fetchHistoricData({ future: true });
        break;
      case 2:
        fetchReportData("category", { period: "since_a_year_ago" });
        break;
      case 3:
        fetchReportData("source", { period: "since_a_year_ago" });
        break;
      case 4:
        fetchReportData("type", { period: "since_a_year_ago" });
        break;
      default:
        break;
    }
    setTabValue(newValue);
  };

  return (
    <Grid container style={{ marginTop: "15px" }} className={classes.root}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={tabValue}
        onChange={handleTabsChange}
        className={classes.tabs}
      >
        <Tab label="Histórico" {...getTabProps(0)} />
        <Tab label="Futuro" {...getTabProps(1)} />
        <Tab label="Por categoria" {...getTabProps(2)} />
        <Tab label="Por fonte" {...getTabProps(3)} />
        <Tab label="Por tipo" {...getTabProps(4)} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {!isLoaded && <Loader />}
        <ExpenseHistoricChartComponent data={data} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        {!isLoaded && <Loader />}
        <ExpenseHistoricChartComponent data={data} future />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        {!isLoaded && <Loader />}
        <ExpenseBarChartComponent
          data={data}
          dataKey="category"
          setData={setData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        {!isLoaded && <Loader />}
        <ExpenseBarChartComponent
          data={data}
          dataKey="source"
          setData={setData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <ExpenseBarChartComponent
          data={data}
          dataKey="type"
          setData={setData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
    </Grid>
  );
};
