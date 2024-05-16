import { useEffect, useState } from "react";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import Skeleton from "@mui/lab/Skeleton";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

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
