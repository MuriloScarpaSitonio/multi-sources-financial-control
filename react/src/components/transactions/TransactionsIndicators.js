import { useEffect, useState } from "react";

import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

import Skeleton from "@material-ui/lab/Skeleton";

import AccountBalanceWalletIcon from "@material-ui/icons/AccountBalanceWallet";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";

import { TransactionsApi } from "../../api";

const SUCCESS = "rgba(0, 201, 20, 0.5)";
const DANGER = "rgba(255, 5, 5, 0.5)";

const Indicators = ({ title, indicators, icon, color, secondaryIcon }) => {
  const hideValues = Boolean(localStorage.getItem("hideValues"));

  const card = (
    <Card>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography color="textPrimary" variant="h3">
              {hideValues ? (
                `R$ ${(
                  indicators.current_bought - indicators.current_sold
                )?.toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                })}`
              ) : (
                <Skeleton animation={false} width={280} />
              )}
            </Typography>
          </Grid>
          <Grid item>
            <Avatar style={{ backgroundColor: color }}>{icon}</Avatar>
          </Grid>
        </Grid>

        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            pt: 2,
          }}
          // style={{
          //   color: color,
          // }}
        >
          {hideValues ? (
            <>
              <Typography variant="body2">
                {`${
                  indicators.current_bought?.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                  }) || 0
                } (compras) - ${indicators.current_sold?.toLocaleString(
                  "pt-br",
                  {
                    minimumFractionDigits: 2,
                  }
                )} (vendas)`}
              </Typography>
            </>
          ) : (
            <Skeleton animation={false} width={300} />
          )}
        </Box>
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

  return card;
};

export const TransactionsIndicators = () => {
  const [indicators, setIndicators] = useState({});

  const [isLoaded, setIsLoaded] = useState(false);

  function fetchData() {
    setIsLoaded(false);
    let api = new TransactionsApi();

    api
      .indicators()
      .then((response) => setIndicators(response.data))
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
                title="APORTES MENSAIS"
                indicators={indicators}
                icon={<AccountBalanceWalletIcon />}
                color={indicators.diff_percentage > 0 ? SUCCESS : DANGER}
                secondaryIcon={
                  indicators.diff_percentage > 0 ? (
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
    </>
  );
};
