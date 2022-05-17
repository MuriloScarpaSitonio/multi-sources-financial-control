import { useEffect, useState } from "react";

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
import { AssetsApi } from "../../api";
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

const AssetPiechart = ({ data }) => {
  return (
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
        label={(l) => `${l.payload.total.toLocaleString("pt-br")}%`}
      >
        <Cell key="cell-0" fill={currentDataFillColor} />
        <Cell key="cell-1" fill={lastDataFillCollor} />
      </Pie>
    </PieChart>
  );
};

const AssetHorizontalBarChart = ({ data }) => (
  <BarChart
    width={chartWidth}
    height={chartHeight}
    data={data}
    layout="vertical"
    margin={{ left: 55 }}
    barGap={-30}
  >
    <CartesianGrid stroke="#eee" />
    <XAxis type="number" tickFormatter={(t) => `R$ ${t}`} />
    <YAxis type="category" dataKey="type" />
    <ChartTooltip
      cursor={{ fill: "#f5f5f5" }}
      separator=": "
      formatter={(value) => `R$ ${value.toLocaleString("pt-br")}`}
      labelFormatter={(_) => ""}
    />
    <Bar dataKey="total" barSize={chartBarSize} fill={currentDataFillColor} />
  </BarChart>
);

const AssetBarChartComponent = ({ data, fetchReportData }) => {
  const PERCENTAGE_REPORT_TEXT = "Percentual";
  const TOTAL_AMOUNT_REPORT_TEXT = "Montante investido";
  const PERCENTAGE_REPORT_TEXT_CURRENT = "Percentual (atual)";
  const TOTAL_AMOUNT_REPORT_TEXT_CURRENT = "Montante investido (atual)";

  const FILTERS_MAP = {};
  FILTERS_MAP[PERCENTAGE_REPORT_TEXT] = { percentage: true, current: false };
  FILTERS_MAP[TOTAL_AMOUNT_REPORT_TEXT] = {
    percentage: false,
    current: false,
  };
  FILTERS_MAP[PERCENTAGE_REPORT_TEXT_CURRENT] = {
    percentage: true,
    current: true,
  };
  FILTERS_MAP[TOTAL_AMOUNT_REPORT_TEXT_CURRENT] = {
    percentage: false,
    current: true,
  };

  const [anchorEl, setAnchorEl] = useState(null);
  const [buttonText, setButtonText] = useState(PERCENTAGE_REPORT_TEXT);
  const [menuItems, setMenuItems] = useState([
    TOTAL_AMOUNT_REPORT_TEXT,
    PERCENTAGE_REPORT_TEXT_CURRENT,
    TOTAL_AMOUNT_REPORT_TEXT_CURRENT,
  ]);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = (event, index) => {
    fetchReportData(FILTERS_MAP[event.target.innerText]);
    const newItems = [...menuItems];
    newItems.splice(index, 1);
    setMenuItems([...newItems, buttonText]);
    setButtonText(event.target.innerText);
    setAnchorEl(null);
  };

  let chart = FILTERS_MAP[buttonText].percentage ? (
    <AssetPiechart data={data} />
  ) : (
    <AssetHorizontalBarChart data={data} />
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
              {menuItems.map((item, index) => (
                <MenuItem onClick={(e) => handleClose(e, index)}>
                  {item}
                </MenuItem>
              ))}
            </Menu>
          </>
        }
      />
      <Divider />
      <CardContent>{chart}</CardContent>
    </Card>
  );
};
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

export const AssetsReports = () => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  //const [error, setError] = useState(null);

  let api = new AssetsApi();
  const classes = useStyles();

  function fetchReportData(filters = {}) {
    setIsLoaded(false);
    api
      .report(filters)
      .then((response) => setData(response.data))
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }
  useEffect(() => fetchReportData({ percentage: true, current: false }), []);

  return (
    <Grid container style={{ marginTop: "15px" }} className={classes.root}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={0}
        className={classes.tabs}
      >
        <Tab label="Por tipo" {...getTabProps(0)} />
      </Tabs>

      <TabPanel value={0} index={0}>
        {!isLoaded && <Loader />}
        <AssetBarChartComponent data={data} fetchReportData={fetchReportData} />
      </TabPanel>
    </Grid>
  );
};
