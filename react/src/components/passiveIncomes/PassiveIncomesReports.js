import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  CartesianGrid,
  ReferenceLine,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

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

import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";

import { Loader } from "../Loaders";
import { PassiveIncomesApi } from "../../api";
import { makeStyles } from "@material-ui/core/styles";

const chartWidth = 950;
const chartHeight = 300;
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

function getTabProps(index) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

const PassiveIncomesHistoricChartComponent = ({ data }) => (
  <Card elevation={6}>
    <CardHeader />
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
    </CardContent>
  </Card>
);

const PassiveIncomeHorizontalBarChartComponent = ({
  data,
  fetchAssetsAggregationData,
}) => {
  const LAST_12_MONTHS_REPORT_TEXT = "Últimos 12 meses";
  const ALL_TIME_REPORT_TEXT = "Todo o período";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(LAST_12_MONTHS_REPORT_TEXT);
  const [menuText, setMenuText] = useState(ALL_TIME_REPORT_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    // we haven't changed it yet
    menuText === LAST_12_MONTHS_REPORT_TEXT
      ? fetchAssetsAggregationData()
      : fetchAssetsAggregationData({ all: true });

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
        <BarChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          layout="vertical"
          margin={{ left: 55 }}
        >
          <CartesianGrid stroke="#eee" />
          <XAxis type="number" tickFormatter={(t) => `R$ ${t}`} />
          <YAxis type="category" dataKey="code" />
          <ChartTooltip
            cursor={{ fill: "#f5f5f5" }}
            separator=": "
            formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
            labelFormatter={(_) => ""}
          />
          <Bar dataKey="total" barSize={20} fill={currentDataFillColor} />
        </BarChart>
      </CardContent>
    </Card>
  );
};

export const PassiveIncomesReports = () => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  //const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  const classes = useStyles();

  let api = new PassiveIncomesApi();

  function fetchHistoricData() {
    setIsLoaded(false);
    api
      .historic()
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }
  function fetchAssetsAggregationData(filters = {}) {
    setIsLoaded(false);
    api
      .assetsAggregationReport(filters)
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
        fetchAssetsAggregationData();
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
        <Tab label="Top 10 ativos" {...getTabProps(1)} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {!isLoaded && <Loader />}
        <PassiveIncomesHistoricChartComponent data={data} />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        {!isLoaded && <Loader />}
        <PassiveIncomeHorizontalBarChartComponent
          data={data}
          fetchAssetsAggregationData={fetchAssetsAggregationData}
        />
      </TabPanel>
    </Grid>
  );
};
