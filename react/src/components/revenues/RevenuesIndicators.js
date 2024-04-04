import { useEffect, useState } from "react";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import Skeleton from "@mui/lab/Skeleton";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

import { RevenuesApi } from "../../api";

const SUCCESS = "rgba(0, 201, 20, 0.5)";
const DANGER = "rgba(255, 5, 5, 0.5)";

const Indicators = ({ title, indicators, icon, color, secondaryIcon }) => {
  const indicatorsMonth = indicators.month;
  const currentMonth = new Date().getMonth() + 1;
  const isPastRevenue = parseInt(indicatorsMonth) < currentMonth;
  const borderStyle = isPastRevenue ? "1px solid red" : "1px solid white";
  const hideValues = Boolean(localStorage.getItem("hideValues"));

  return (
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
            <Avatar
              style={
                isPastRevenue
                  ? { backgroundColor: "#ff7878" }
                  : { backgroundColor: color }
              }
            >
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
                title="RECEITA MENSAL"
                indicators={data}
                icon={<AccountBalanceIcon />}
                color={data.diff >= 0 ? SUCCESS : DANGER}
                secondaryIcon={
                  data.diff >= 0 ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />
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
