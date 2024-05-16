import { useEffect, useState } from "react";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import Skeleton from "@mui/lab/Skeleton";

import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

import { PassiveIncomesApi } from "../../api";

const SUCCESS = "rgba(0, 201, 20, 0.5)";
const DANGER = "rgba(255, 5, 5, 0.5)";

const ExtraIndicators = ({
  firstValue,
  firstColor,
  firstText,
  secondValue,
  secondColor,
  secondText,
}) => {
  const hideValues = Boolean(localStorage.getItem("hideValues"));
  return (
    <>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          pt: 2,
        }}
      >
        <Typography
          variant="body2"
          style={{
            color: firstColor,
          }}
        >
          {hideValues ? firstValue : <Skeleton animation={false} width={100} />}
        </Typography>
        <Typography
          color="textSecondary"
          variant="body2"
          style={{ marginLeft: "8px" }}
        >
          {firstText}
        </Typography>
      </Box>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          pt: 2,
        }}
      >
        <Typography
          variant="body2"
          style={{
            color: secondColor,
          }}
        >
          {hideValues ? (
            secondValue
          ) : (
            <Skeleton animation={false} width={100} />
          )}
        </Typography>
        <Typography
          color="textSecondary"
          variant="body2"
          style={{ marginLeft: "8px" }}
        >
          {secondText}
        </Typography>
      </Box>
    </>
  );
};

const Indicators = ({ title, value, icon, color, extraIndicators = <></> }) => {
  const hideValues = Boolean(localStorage.getItem("hideValues"));
  return (
    <Card>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography color="textPrimary" variant="h3">
              {hideValues ? (
                `R$ ${value?.toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                })}`
              ) : (
                <Skeleton animation={false} width={250} />
              )}
            </Typography>
          </Grid>
          <Grid item>
            <Avatar style={{ backgroundColor: color }}>{icon}</Avatar>
          </Grid>
        </Grid>
        {extraIndicators}
      </CardContent>
    </Card>
  );
};

export const PassiveIncomesIndicators = () => {
  const [indicators, setIndicators] = useState({
    avg: 0,
    current_credited: 0,
    provisioned_future: 0,
    diff_percentage: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  function getExtraIndicators() {
    return (
      <ExtraIndicators
        firstValue={`R$ ${indicators.provisioned_future?.toLocaleString(
          "pt-br",
          {
            minimumFractionDigits: 2,
          } || 0
        )}`}
        firstColor={indicators.provisioned_future ? SUCCESS : null}
        firstText={"Provisionados"}
        secondValue={`${
          indicators.diff_percentage?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          }) || 0
        }%`}
        secondColor={indicators.diff_percentage > 0 ? SUCCESS : DANGER}
        secondText={`Em relação a média (R$ ${indicators.avg?.toLocaleString(
          "pt-br",
          {
            minimumFractionDigits: 2,
          } || 0
        )})`}
      />
    );
  }

  function fetchData() {
    setIsLoaded(false);
    new PassiveIncomesApi()
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
                title={"RENDA PASSIVA"}
                value={indicators.current_credited}
                icon={<AttachMoneyIcon />}
                color={
                  indicators.current_credited > indicators.avg
                    ? SUCCESS
                    : DANGER
                }
                extraIndicators={getExtraIndicators()}
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
