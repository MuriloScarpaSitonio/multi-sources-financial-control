import { useEffect, useState } from "react";

import axios from "axios";
import { makeStyles, withStyles } from "@mui/styles";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import Skeleton from "@mui/lab/Skeleton";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AddIcon from "@mui/icons-material/Add";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";

import { ExpensesApi, RevenuesApi } from "../../api";
import { RevenuesForm } from "../../forms/RevenuesForm";
import { FormFeedback } from "../FormFeedback";

const SUCCESS = "rgba(0, 201, 20, 0.5)";
const DANGER = "rgba(255, 5, 5, 0.5)";

const CustomLinearProgress = withStyles((theme) => ({
  root: {
    height: 10,
    borderRadius: 5,
  },
  colorPrimary: {
    // backgroundColor:
    //   theme.palette.grey[theme.palette.type === "light" ? 200 : 700],
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

const RevenuesCreateDialog = ({
  data,
  open,
  onClose,
  showSuccessFeedbackForm,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="revenue-form-dialog-title"
    >
      <DialogTitle id="revenue-form-dialog-title">
        {data && Object.keys(data).length > 0
          ? "Editar receita"
          : "Criar receita"}
      </DialogTitle>
      <DialogContent>
        <RevenuesForm
          initialData={data}
          handleClose={onClose}
          reloadTable={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
};

const Indicators = ({
  title,
  indicators,
  icon,
  color,
  secondaryIcon,
  condensed = false,
  setCreateRevenueDialogIsOpened = null,
}) => {
  const isRevenue = title.includes("RECEITA");
  const hideValues = Boolean(localStorage.getItem("hideValues"));

  return (
    <Card style={{ border: "1px solid white", height: condensed ? 160 : 180 }}>
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
            <Avatar style={{ backgroundColor: color }}>{icon}</Avatar>
          </Grid>
        </Grid>
        {!isRevenue && !condensed && (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
            }}
          >
            {hideValues ? (
              <>
                <AddIcon color="disabled" />
                <Typography color="textSecondary" variant="body2">
                  {`R$ ${indicators.future?.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                  })} à pagar`}
                </Typography>
              </>
            ) : (
              <Skeleton animation={false} width={150} />
            )}
          </Box>
        )}
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
          {isRevenue && !condensed && (
            <Box sx={{ ml: 1 }}>
              <IconButton>
                <AddIcon
                  fontSize="small"
                  onClick={() => setCreateRevenueDialogIsOpened(true)}
                />
              </IconButton>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export const ExpensesIndicators = ({ condensed = false }) => {
  const [expensesIndicators, setExpensesIndicators] = useState({});
  const [revenuesIndicators, setRevenuesIndicators] = useState({});
  const [createRevenueDialogIsOpened, setCreateRevenueDialogIsOpened] =
    useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const showSuccessFeedbackForm = (message) => {
    setAlertInfos({ message: message, severity: "success" });
    setShowAlert(true);
  };

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
                title="DESPESAS MENSAIS"
                indicators={expensesIndicators}
                icon={<MonetizationOnIcon />}
                color={expensesIndicators.diff > 0 ? DANGER : SUCCESS}
                secondaryIcon={
                  expensesIndicators.diff > 0 ? (
                    <ArrowUpwardIcon />
                  ) : (
                    <ArrowDownwardIcon />
                  )
                }
                condensed={condensed}
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
          <Grid item>
            {isLoaded ? (
              <Indicators
                title="RECEITA MENSAL"
                indicators={revenuesIndicators}
                icon={<AccountBalanceIcon />}
                color={revenuesIndicators.diff >= 0 ? SUCCESS : DANGER}
                secondaryIcon={
                  revenuesIndicators.diff >= 0 ? (
                    <ArrowUpwardIcon />
                  ) : (
                    <ArrowDownwardIcon />
                  )
                }
                setCreateRevenueDialogIsOpened={setCreateRevenueDialogIsOpened}
                condensed={condensed}
              />
            ) : (
              <Skeleton variant="rect" width={340} height={175} />
            )}
          </Grid>
        </Grid>
      </Container>
      {!condensed && (
        <Container
          style={{ position: "relative", marginTop: "15px" }}
          maxWidth="lg"
        >
          {isLoaded ? (
            <LinearProgressWithLabel
              value={
                (expensesIndicators.total / revenuesIndicators.total) * 100 || 0
              }
            />
          ) : (
            <Skeleton />
          )}
        </Container>
      )}
      <RevenuesCreateDialog
        data={{}}
        open={createRevenueDialogIsOpened}
        onClose={() => setCreateRevenueDialogIsOpened(false)}
        showSuccessFeedbackForm={showSuccessFeedbackForm}
      />
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};
