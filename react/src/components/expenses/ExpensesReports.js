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

import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Divider from "@material-ui/core/Divider";
import CardContent from "@material-ui/core/CardContent";
import Grid from "@material-ui/core/Grid";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import Typography from "@material-ui/core/Typography";

import { Loader } from "../Loaders";
import { ExpensesApi } from "../../api";
import { makeStyles } from "@material-ui/core/styles";

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
    borderRight: `1px solid ${theme.palette.divider}`,
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

// const CustomChartTooltip = () => (
//   <ChartTooltip
//     cursor={{ fill: "#f5f5f5" }}
//     separator=": "
//     formatter={(value) => `R$ ${value}`.replace(".", ",")}
//     labelFormatter={(_) => ""}
//   />
// );

const ExpenseHorizontalBarChart = ({ data, dataKey }) => (
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
    <YAxis type="category" dataKey={dataKey} />
    <ChartTooltip
      cursor={{ fill: "#f5f5f5" }}
      separator=": "
      formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
      labelFormatter={(_) => ""}
    />
    <Bar dataKey="total" barSize={chartBarSize} fill={currentDataFillColor} />
  </BarChart>
);

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
    <YAxis minTickGap={4} type="category" dataKey={dataKey} yAxisId={0} />
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
      ? fetchReportData(dataKey.toUpperCase())
      : fetchReportData(dataKey.toUpperCase(), { all: true });

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

const ExpenseHistoricChartComponent = ({ data }) => {
  const REPORT_TEXT = "Todos os custos";
  const TYPE_HISTORIC_REPORT_TEXT = "Fixo X Variável";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(REPORT_TEXT);
  const [menuText, setMenuText] = useState(TYPE_HISTORIC_REPORT_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
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
          <ReferenceLine
            y={data.avg}
            label="Média"
            stroke="#e65100"
            strokeDasharray="3 3"
          />
        </BarChart>
        {/* <LineChart width={chartWidth} height={chartHeight} data={data}>
          <CartesianGrid stroke="#eee" />
          <XAxis dataKey="month" />
          <YAxis />
          <ChartTooltip
            cursor={{ fill: "#f5f5f5" }}
            separator=": "
            formatter={(value) => `R$ ${value}`.replace(".", ",")}
            labelFormatter={(_) => ""}
          />
          <Line type="monotone" dataKey="total" stroke={currentDataFillColor} />
        </LineChart> */}
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

  function fetchHistoricData() {
    setIsLoaded(false);
    api
      .historic()
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  function fetchReportData(type_of_report, filters = {}) {
    setIsLoaded(false);
    api
      .report(type_of_report, filters)
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  useEffect(() => fetchHistoricData(), []);

  const handleTabsChange = (event, newValue) => {
    switch (newValue) {
      case 0:
        fetchHistoricData();
        break;
      case 1:
        fetchReportData("CATEGORY");
        break;
      case 2:
        fetchReportData("SOURCE");
        break;
      case 3:
        fetchReportData("TYPE");
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
        <Tab label="Por categoria" {...getTabProps(1)} />
        <Tab label="Por fonte" {...getTabProps(2)} />
        <Tab label="Por tipo" {...getTabProps(3)} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {!isLoaded && <Loader />}
        <ExpenseHistoricChartComponent data={data} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        {!isLoaded && <Loader />}
        <ExpenseBarChartComponent
          data={data}
          dataKey="category"
          setData={setData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        {!isLoaded && <Loader />}
        <ExpenseBarChartComponent
          data={data}
          dataKey="source"
          setData={setData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
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
