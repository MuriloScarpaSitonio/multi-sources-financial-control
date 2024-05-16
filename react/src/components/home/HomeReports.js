import { useEffect, useState } from "react";

import axios from "axios";

import {
  BarChart,
  Bar,
  CartesianGrid,
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
import { AssetsApi, ExpensesApi, RevenuesApi } from "../../api";
import { AssetRoiChartComponent } from "../assets/AssetsReports";
import { makeStyles } from "@mui/styles";

const chartWidth = 950;
const chartHeight = 300;
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

function getTabProps(index) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}

const ExpenseRevenueHistoricChartComponent = ({ data }) => {
  const ONLY_DIFF_TEXT = "Diferença entre receitas e despesas";
  const BUY_AND_SELL_TEXT = "Receitas e despesas";

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(ONLY_DIFF_TEXT);
  const [menuText, setMenuText] = useState(BUY_AND_SELL_TEXT);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    setButtonText(menuText);
    setMenuText(buttonText);
    setAnchorEl(null);
  };

  let chart =
    buttonText === ONLY_DIFF_TEXT ? (
      <>
        <Bar dataKey="diff" fill={currentDataFillColor} />
        <ReferenceLine
          y={data.avg}
          label="Média"
          stroke="#e65100"
          strokeDasharray="3 3"
        />
      </>
    ) : (
      <>
        <Bar dataKey="revenues" stackId="a" fill="rgba(0, 201, 20, 0.2)" />
        <Bar dataKey="expenses" stackId="a" fill="rgba(255, 5, 5, 0.2)" />
      </>
    );
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
          stackOffset="sign"
          data={data.historic}
        >
          <CartesianGrid stroke="#eee" />
          <XAxis dataKey="month" />
          <YAxis />
          {buttonText !== ONLY_DIFF_TEXT && (
            <ReferenceLine y={0} stroke="#000" />
          )}
          <ChartTooltip
            cursor={{ fill: "#f5f5f5" }}
            separator=": "
            formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
            labelFormatter={(_) => ""}
          />
          {chart}
        </BarChart>
        {/* {data.historic.length > 0 ? (
          <BarChart
            width={chartWidth}
            height={chartHeight}
            stackOffset="sign"
            data={data.historic}
          >
            <CartesianGrid stroke="#eee" />
            <XAxis dataKey="month" />
            <YAxis />
            {buttonText !== ONLY_DIFF_TEXT && (
              <ReferenceLine y={0} stroke="#000" />
            )}
            <ChartTooltip
              cursor={{ fill: "#f5f5f5" }}
              separator=": "
              formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
              labelFormatter={(_) => ""}
            />
            {chart}
          </BarChart>
        ) : (
          "No data"
        )} */}
      </CardContent>
    </Card>
  );
};

export const HomeReports = ({
  isPersonalFinancesModuleEnabled,
  isInvestmentsModuleEnabled,
}) => {
  const [data, setData] = useState({ historic: [], avg: 0 });
  const [roiData, setRoiData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const classes = useStyles();

  function fetchRoiReportData(filters = {}) {
    setIsLoaded(false);
    new AssetsApi()
      .roiReport(filters)
      .then((response) => setRoiData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  function fetchHistoricData() {
    setIsLoaded(false);
    let expensesApi = new ExpensesApi();
    let revenuesApi = new RevenuesApi();

    axios
      .all([expensesApi.historic(), revenuesApi.historic()])
      .then(
        axios.spread((...responses) => {
          let expensesHistoricData = responses[0].data.historic;
          let revenuesHistoricData = responses[1].data.historic;
          let result = revenuesHistoricData.map((d, index) => {
            return {
              expenses: expensesHistoricData[index].total * -1,
              revenues: d.total,
              diff: d.total - expensesHistoricData[index].total,
              month: d.date,
            };
          });
          function getAvg(r) {
            let total = 0;
            for (const d of r.slice(0, -1)) {
              total += d.diff;
            }
            return total / (r.length - 1);
          }
          setData({
            historic: result,
            avg: getAvg(result),
          });
        })
      )
      .finally(() => setIsLoaded(true));
  }

  useEffect(
    () =>
      isPersonalFinancesModuleEnabled
        ? fetchHistoricData()
        : fetchRoiReportData({ opened: true, closed: true }),
    []
  );

  const handleTabsChange = (_, newValue) => {
    switch (newValue) {
      case 0:
        fetchHistoricData();
        break;
      case 1:
        fetchRoiReportData({ opened: true, closed: true });
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
        {isPersonalFinancesModuleEnabled && (
          <Tab label="Despesas x receitas" {...getTabProps(0)} />
        )}
        {isInvestmentsModuleEnabled && (
          <Tab
            label="ROI"
            {...getTabProps(isPersonalFinancesModuleEnabled ? 1 : 0)}
          />
        )}
      </Tabs>

      {isPersonalFinancesModuleEnabled && (
        <TabPanel value={tabValue} index={0}>
          {!isLoaded && <Loader />}
          <ExpenseRevenueHistoricChartComponent data={data} />
        </TabPanel>
      )}
      <TabPanel
        value={tabValue}
        index={isPersonalFinancesModuleEnabled ? 1 : 0}
      >
        {!isLoaded && <Loader />}
        <AssetRoiChartComponent
          data={roiData}
          fetchReportData={fetchRoiReportData}
        />
      </TabPanel>
    </Grid>
  );
};
