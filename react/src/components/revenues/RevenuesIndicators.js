import { useEffect, useState } from "react";

import { withStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import Skeleton from "@material-ui/lab/Skeleton";

import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";

import { RevenuesApi } from "../../api";

const SUCCESS = "#00c914";
const DANGER = "#ff0505";

const StyledTooltip = withStyles((theme) => ({
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: "1px solid #dadde9",
  },
}))(Tooltip);

const Indicators = ({ title, indicators, icon, color, secondaryIcon }) => {
  const indicatorsMonth = indicators.month;
  const currentMonth = new Date().getMonth() + 1;
  const isPastRevenue = parseInt(indicatorsMonth) < currentMonth;
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
                <Skeleton animation={false} width={280} />
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
            pt: 2,
          }}
          style={{
            color: color,
          }}
        >
          {hideValues ? (
            <>
              {secondaryIcon}
              <Typography variant="body2">
                {`${
                  indicators.diff?.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                  }) || 0
                }%`}
              </Typography>
              <Typography
                color="textSecondary"
                variant="body2"
                style={{ marginLeft: "8px" }}
              >
                Em relação a média (
                {`R$ ${indicators.avg?.toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                })}`}
                )
              </Typography>
            </>
          ) : (
            <Skeleton animation={false} width={300} />
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
          Clique no botão +1 da tabela abaixo para adicionar
        </>
      }
    >
      {card}
    </StyledTooltip>
  ) : (
    card
  );
};

export const RevenuesIndicators = () => {
  const [data, setData] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  function fetchData() {
    setIsLoaded(false);
    let api = new RevenuesApi();

    api
      .indicators()
      .then((response) => setData(response.data))
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
                title="INDICADORES"
                indicators={data}
                icon={<AccountBalanceIcon />}
                color={data.diff > 0 ? SUCCESS : DANGER}
                secondaryIcon={
                  data.diff > 0 ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />
                }
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
        </Grid>
      </Container>
    </>
  );
};
