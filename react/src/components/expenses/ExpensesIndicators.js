import { useEffect, useState } from "react";

import axios from "axios";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import LinearProgress from "@material-ui/core/LinearProgress";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import Skeleton from "@material-ui/lab/Skeleton";

import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import AddIcon from "@material-ui/icons/Add";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";

import { ExpensesApi, RevenuesApi } from "../../api";

const SUCCESS = "#00c914";
const DANGER = "#ff0505";

const CustomLinearProgress = withStyles((theme) => ({
  root: {
    height: 10,
    borderRadius: 5,
  },
  colorPrimary: {
    backgroundColor:
      theme.palette.grey[theme.palette.type === "light" ? 200 : 700],
  },
}))(LinearProgress);

const useStyles = makeStyles({
  success: {
    backgroundColor: SUCCESS,
  },
  warning: {
    backgroundColor: "#ff8f05",
  },
  danger: {
    backgroundColor: DANGER,
  },
});

const StyledTooltip = withStyles((theme) => ({
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: "1px solid #dadde9",
  },
}))(Tooltip);

const LinearProgressWithLabel = (props) => {
  const classes = useStyles();

  function getBarClass() {
    let className = "success";
    if (70 < props.value && props.value <= 90) {
      className = "warning";
    } else if (props.value > 90) {
      className = "danger";
    }
    return classes[className];
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box sx={{ width: "100%", mr: 1 }}>
        <CustomLinearProgress
          variant="determinate"
          {...props}
          classes={{ bar: getBarClass() }}
        />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="h6" color="text.secondary">
          {`${props.value?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}%`}
        </Typography>
      </Box>
    </Box>
  );
};

const Indicators = ({ title, indicators, icon, color, secondaryIcon }) => {
  const indicatorsMonth = indicators.month.split("/")[1];
  const currentMonth = new Date().getMonth() + 1;
  const isRevenue = title.includes("RECEITA");
  const isPastRevenue = isRevenue && parseInt(indicatorsMonth) !== currentMonth;
  const borderStyle = isPastRevenue ? "1px solid red" : "1px solid white";
  const hideValues = Boolean(window.localStorage.getItem("hideValues"));

  const card = (
    <Card style={{ border: borderStyle, height: 180 }}>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography color="textPrimary" variant="h3">
              {hideValues ? (
                `R$ ${indicators.total?.toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                })}`
              ) : (
                <Skeleton animation={false} width={250} />
              )}
            </Typography>
          </Grid>
          <Grid item>
            <Avatar style={isPastRevenue ? { backgroundColor: "#ff7878" } : {}}>
              {icon}
            </Avatar>
          </Grid>
        </Grid>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            pt: isRevenue ? 1 : 2,
          }}
          style={{
            color: color,
          }}
        >
          {secondaryIcon}
          <Typography variant="body2">
            {`${
              indicators.diff_percentage?.toLocaleString("pt-br", {
                minimumFractionDigits: 2,
              }) || 0
            }%`}
          </Typography>
          <Typography
            color="textSecondary"
            variant="body2"
            style={{ marginLeft: "8px" }}
          >
            Em relação ao último mês
          </Typography>
          {isRevenue && (
            <Box sx={{ ml: 1 }}>
              <IconButton>
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return isPastRevenue ? (
    <StyledTooltip
      title={
        <>
          <Typography color="inherit">
            Você não cadastrou nenhuma receita este mês!
          </Typography>
          Clique no botão + para adicionar
        </>
      }
    >
      {card}
    </StyledTooltip>
  ) : (
    card
  );
};

export const ExpensesIndicators = () => {
  const [expensesIndicators, setExpensesIndicators] = useState({});
  const [revenuesIndicators, setRevenuesIndicators] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  function fetchData() {
    setIsLoaded(false);
    let expensesApi = new ExpensesApi();
    let revenuesApi = new RevenuesApi();

    axios
      .all([expensesApi.indicators(), revenuesApi.indicators()])
      .then(
        axios.spread((...responses) => {
          setExpensesIndicators(responses[0].data);
          setRevenuesIndicators(responses[1].data);
        })
      )
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  useEffect(() => fetchData(), []);

  return (
    <>
      <Container
        style={{ position: "relative", marginTop: "15px" }}
        maxWidth="lg"
      >
        <Grid container justifyContent="center" spacing={3}>
          <Grid item>
            {isLoaded ? (
              <Indicators
                title={"DESPESAS MENSAIS"}
                indicators={expensesIndicators}
                icon={<MonetizationOnIcon />}
                color={expensesIndicators.diff > 0 ? DANGER : SUCCESS}
                secondaryIcon={
                  expensesIndicators.diff > 0 ? (
                    <ArrowDownwardIcon />
                  ) : (
                    <ArrowUpwardIcon />
                  )
                }
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
          <Grid item>
            {isLoaded ? (
              <Indicators
                title={"RECEITA MENSAL"}
                indicators={revenuesIndicators}
                icon={<AccountBalanceIcon />}
                color={revenuesIndicators.diff > 0 ? SUCCESS : DANGER}
                secondaryIcon={
                  revenuesIndicators.diff > 0 ? (
                    <ArrowUpwardIcon />
                  ) : (
                    <ArrowDownwardIcon />
                  )
                }
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
        </Grid>
      </Container>
      <Container
        style={{ position: "relative", marginTop: "15px" }}
        maxWidth="lg"
      >
        {isLoaded ? (
          <LinearProgressWithLabel
            value={(expensesIndicators.total / revenuesIndicators.total) * 100}
          />
        ) : (
          <Skeleton />
        )}
      </Container>
    </>
  );
};
