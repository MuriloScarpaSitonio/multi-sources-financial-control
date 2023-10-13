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
import { TransactionsApi } from "../../api";
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

const TransactionHistoricChartComponent = ({ data }) => {
  const ONLY_DIFF_TEXT = "Diferença entre compra e venda";
  const BUY_AND_SELL_TEXT = "Compra e venda";

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
        <Bar dataKey="total_bought" stackId="a" fill="rgba(0, 201, 20, 0.2)" />
        <Bar dataKey="total_sold" stackId="a" fill="rgba(255, 5, 5, 0.2)" />
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
      </CardContent>
    </Card>
  );
};

export const TransactionsReports = () => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  //const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  let api = new TransactionsApi();
  const classes = useStyles();

  function fetchHistoricData(filters = {}) {
    setIsLoaded(false);
    api
      .historic(filters)
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
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {!isLoaded && <Loader />}
        <TransactionHistoricChartComponent
          data={data}
        />
      </TabPanel>
    </Grid>
  );
};
