import { useEffect, useState } from "react";

import axios from "axios";

import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

import Skeleton from "@material-ui/lab/Skeleton";

import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import AttachMoneyIcon from "@material-ui/icons/AttachMoney";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import TrendingDownIcon from "@material-ui/icons/TrendingDown";

import { AssetsApi, PassiveIncomesApi } from "../../api";

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
  const hideValues = Boolean(window.localStorage.getItem("hideValues"));
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
  const hideValues = Boolean(window.localStorage.getItem("hideValues"));
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

export const AssetsIndicators = ({ condensed = false }) => {
  const [assetsIndicators, setAssetsIndicators] = useState({
    current_total: 0,
    ROI: 0,
    ROI_opened: 0,
    ROI_finished: 0,
  });
  const [incomesIndicators, setIncomesIndicators] = useState({
    avg: 0,
    current_credited: 0,
    provisioned_future: 0,
    diff_percentage: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  function getAssetsExtraIndicators() {
    return (
      <ExtraIndicators
        firstValue={`R$ ${assetsIndicators.ROI_opened?.toLocaleString(
          "pt-br",
          {
            minimumFractionDigits: 2,
          } || 0
        )}`}
        firstColor={assetsIndicators.ROI_opened > 0 ? SUCCESS : DANGER}
        firstText={"Posições abertas"}
        secondValue={`R$ ${assetsIndicators.ROI_finished?.toLocaleString(
          "pt-br",
          {
            minimumFractionDigits: 2,
          } || 0
        )}`}
        secondColor={assetsIndicators.ROI_finished > 0 ? SUCCESS : DANGER}
        secondText={"Posições finalizadas"}
      />
    );
  }

  function getPassiveIncomesExtraIndicators() {
    return (
      <ExtraIndicators
        firstValue={`R$ ${incomesIndicators.provisioned_future?.toLocaleString(
          "pt-br",
          {
            minimumFractionDigits: 2,
          } || 0
        )}`}
        firstColor={incomesIndicators.provisioned_future ? SUCCESS : null}
        firstText={"Provisionados"}
        secondValue={`${
          incomesIndicators.diff_percentage?.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          }) || 0
        }%`}
        secondColor={incomesIndicators.diff_percentage > 0 ? SUCCESS : DANGER}
        secondText={`Em relação a média (R$ ${incomesIndicators.avg?.toLocaleString(
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
    let assetsApi = new AssetsApi();
    let passiveIncomesApi = new PassiveIncomesApi();

    axios
      .all([assetsApi.indicators(), passiveIncomesApi.indicators()])
      .then(
        axios.spread((...responses) => {
          setAssetsIndicators(responses[0].data);
          setIncomesIndicators(responses[1].data);
        })
      )
      //.catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }

  useEffect(() => fetchData(), []);

  let roiIndicators = (
    <Grid item>
      {isLoaded ? (
        <Indicators
          title={"ROI (Lucro/Prejuízo)"}
          value={assetsIndicators.ROI}
          icon={
            assetsIndicators.ROI > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />
          }
          color={assetsIndicators.ROI > 0 ? SUCCESS : DANGER}
          extraIndicators={!condensed ? getAssetsExtraIndicators() : <></>}
        />
      ) : (
        <Skeleton variant="rect" width={340} height={175} />
      )}
    </Grid>
  );
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
                title={"PATRIMÔNIO TOTAL"}
                value={assetsIndicators.total}
                icon={<AccountBalanceIcon />}
                color={assetsIndicators.total > 0 ? SUCCESS : DANGER}
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
          {condensed && roiIndicators}
        </Grid>
        {!condensed && (
          <Grid container justifyContent="center" spacing={3}>
            {roiIndicators}
            <Grid item>
              {isLoaded ? (
                <Indicators
                  title={"RENDA PASSIVA"}
                  value={incomesIndicators.current_credited}
                  icon={<AttachMoneyIcon />}
                  color={
                    incomesIndicators.current_credited > incomesIndicators.avg
                      ? SUCCESS
                      : DANGER
                  }
                  extraIndicators={getPassiveIncomesExtraIndicators()}
                />
              ) : (
                <Skeleton variant="rect" width={340} height={175} />
              )}
            </Grid>
          </Grid>
        )}
      </Container>
    </>
  );
};
