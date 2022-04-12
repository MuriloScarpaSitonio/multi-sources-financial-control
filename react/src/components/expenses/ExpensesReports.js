import { useEffect, useState } from "react";

import axios from "axios";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  //Line,
  //LineChart,
  Pie,
  PieChart,
  Legend,
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

function formatDateString(month, year) {
  return `${(month < 10 ? "0" : "") + month}/${year.toString().substr(-2)}`;
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

const ExpenseHorizontalMultipleBarChart = ({
  data,
  dataKey,
  currentDateString,
  lastDateString,
}) => (
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
      formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
      labelFormatter={(_) => ""}
    />
    <Legend />
    <Bar
      dataKey={lastDateString}
      barSize={dataKey === "category" ? chartBarSize : chartBarSize * 2}
      yAxisId={0}
      fill={lastDataFillCollor}
    />
    <Bar
      dataKey={currentDateString}
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

function mergeReportData(infos, dataKey) {
  /*
    infos should be something like
    [
        {"data": data1, "dateString": "month/year"},
        {"data": data2, "dateString": "month/year"}
    ]
    */
  const newestDateString = infos[0].dateString;
  infos.sort((info1, info2) => info2.data.length - info1.data.length);
  const [longest, shortest] = infos;

  let result = [];
  for (const item of longest.data) {
    let partialResult = {};
    partialResult[dataKey] = item[dataKey];
    partialResult[longest.dateString] = item.total;
    partialResult[shortest.dateString] = 0;

    for (const i of shortest.data) {
      if (item[dataKey] === i[dataKey])
        partialResult[shortest.dateString] = i.total;
    }

    result.push(partialResult);
  }
  return result.sort(
    (item1, item2) => item2[newestDateString] - item1[newestDateString]
  );
}

function getReportPeriod() {
  let date = new Date();
  const currentMonth = date.getMonth() + 1;
  const currentYear = date.getFullYear();

  date.setDate(0); // 0 will result in the last day of the previous month
  const lastMonth = date.getMonth() + 1;
  const lastYear = date.getFullYear();

  return [
    [currentMonth, lastMonth],
    [currentYear, lastYear],
  ];
}

const ExpensePieChartComponent = ({ data, fetchReportData, filters }) => {
  const REPORT_TEXT = "Mês atual";
  const ALL_TIME_REPORT_TEXT = "Todo o período";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(REPORT_TEXT);
  const [menuText, setMenuText] = useState(ALL_TIME_REPORT_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = (e) => {
    // we haven't changed it yet
    menuText === REPORT_TEXT
      ? fetchReportData("TYPE", filters)
      : fetchReportData("TYPE");

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
        <PieChart width={chartWidth} height={chartHeight}>
          <Legend />
          <Pie
            data={data}
            dataKey="total"
            nameKey="type"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            // if the animation is active the label won't show
            isAnimationActive={false}
            label={(l) => `R$ ${l.payload.total.toLocaleString("pt-br")}`}
          >
            <Cell key="cell-0" fill={currentDataFillColor} />
            <Cell key="cell-1" fill={lastDataFillCollor} />
          </Pie>
        </PieChart>
      </CardContent>
    </Card>
  );
};

const ExpenseBarChartComponent = ({
  data,
  dataKey,
  currentDateString,
  lastDateString,
  fetchComparativeReportData,
  fetchReportData,
}) => {
  const COMPARATIVE_REPORT_TEXT = "Mês atual X Mês anterior";
  const ALL_TIME_REPORT_TEXT = "Todo o período";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(COMPARATIVE_REPORT_TEXT);
  const [menuText, setMenuText] = useState(ALL_TIME_REPORT_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    // we haven't changed it yet
    menuText === COMPARATIVE_REPORT_TEXT
      ? fetchComparativeReportData(dataKey.toUpperCase())
      : fetchReportData(dataKey.toUpperCase());

    setButtonText(menuText);
    setMenuText(buttonText);
    setAnchorEl(null);
  };

  let multipleBarsChart = (
    <ExpenseHorizontalMultipleBarChart
      data={data}
      dataKey={dataKey}
      currentDateString={currentDateString}
      lastDateString={lastDateString}
    />
  );

  let barChart = <ExpenseHorizontalBarChart data={data} dataKey={dataKey} />;

  let chart = menuText === ALL_TIME_REPORT_TEXT ? multipleBarsChart : barChart;
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
      <CardContent>{chart}</CardContent>
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
        <BarChart width={chartWidth} height={chartHeight} data={data}>
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
  const [months, years] = getReportPeriod();
  const [currentMonth, lastMonth] = months;
  const [currentYear, lastYear] = years;
  const currentDateString = formatDateString(currentMonth, currentYear);
  const lastDateString = formatDateString(lastMonth, lastYear);
  const pieChartFilters = { month: currentMonth, year: currentYear };
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

  function fetchComparativeReportData(type_of_report) {
    setIsLoaded(false);

    const currentMonthRequest = api.report(type_of_report, {
      month: currentMonth,
      year: currentYear,
    });
    const lastMonthRequest = api.report(type_of_report, {
      month: lastMonth,
      year: lastYear,
    });

    axios
      .all([currentMonthRequest, lastMonthRequest])
      .then(
        axios.spread((...responses) => {
          const reportData = mergeReportData(
            [
              { data: responses[0].data, dateString: currentDateString },
              { data: responses[1].data, dateString: lastDateString },
            ],
            type_of_report.toLocaleLowerCase()
          );
          setData(reportData);
        })
      )
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
        fetchComparativeReportData("CATEGORY");
        break;
      case 2:
        fetchComparativeReportData("SOURCE");
        break;
      case 3:
        fetchReportData("TYPE", pieChartFilters);
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
          currentDateString={currentDateString}
          lastDateString={lastDateString}
          setData={setData}
          fetchComparativeReportData={fetchComparativeReportData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        {!isLoaded && <Loader />}
        <ExpenseBarChartComponent
          data={data}
          dataKey="source"
          currentDateString={currentDateString}
          lastDateString={lastDateString}
          setData={setData}
          fetchComparativeReportData={fetchComparativeReportData}
          fetchReportData={fetchReportData}
        />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <ExpensePieChartComponent
          data={data}
          fetchReportData={fetchReportData}
          filters={pieChartFilters}
        />
      </TabPanel>
    </Grid>
  );
};
