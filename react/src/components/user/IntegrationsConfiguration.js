import { useState } from "react";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";

import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

import SettingsIcon from "@material-ui/icons/Settings";

import { UserApi } from "../../api";
import { stringToBoolean } from "../../helpers.js";
import { FormFeedback } from "../../components/FormFeedback";
import { BinanceIntegrationConfigurationForm } from "../../forms/BinanceIntegrationConfigurationForm";
import { KuCoinIntegrationConfigurationForm } from "../../forms/KuCoinIntegrationConfigurationForm";

function getButton(value, extra) {
  return value ? (
    <Button color="secondary" {...extra}>
      Desativar
    </Button>
  ) : (
    <Button color="primary" {...extra}>
      Ativar
    </Button>
  );
}

const SimpleActionDialog = ({
  userId,
  actionData,
  integrationLabel,
  verb,
  open,
  buttonColor,
  onClose,
  onAction,
}) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

  const showSuccessFeedbackForm = (message) => {
    setAlertInfos({ message: message, severity: "success" });
    setShowAlert(true);
  };

  const handleClick = () => {
    setIsLoaded(false);
    new UserApi(userId).patch(actionData).then(() => {
      setIsLoaded(true);
      onAction();
      showSuccessFeedbackForm(
        `Integração ${verb.toLowerCase().slice(0, -1) + "da"} com sucesso!`
      );
      onClose();
    });
  };
  return (
    <>
      <Dialog open={open} onClose={onClose} aria-labelledby="dialog-title">
        <DialogTitle id="dialog-title">
          {`Tem certeza que deseja ${verb.toLowerCase()} a integração ${integrationLabel}?`}
        </DialogTitle>
        <DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancelar</Button>
            <Button color={buttonColor} onClick={handleClick}>
              {!isLoaded ? <CircularProgress size={24} /> : verb}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};

const DisableDialog = ({
  userId,
  disableData,
  integrationLabel,
  open,
  onClose,
  onDisable,
}) => {
  return (
    <SimpleActionDialog
      userId={userId}
      actionData={disableData}
      verb={"Desativar"}
      buttonColor={"secondary"}
      integrationLabel={integrationLabel}
      open={open}
      onClose={onClose}
      onAction={onDisable}
    />
  );
};

const ConfigDialog = ({
  ConfigForm,
  userId,
  integrationLabel,
  open,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="expense-form-dialog-title"
    >
      <DialogTitle id="expsense-form-dialog-title">
        {`Atualizar configurações da integração ${integrationLabel}`}
      </DialogTitle>
      <DialogContent>
        <ConfigForm userId={userId} handleClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};

const KucoinIntegrationConfiguration = ({ userId }) => {
  const [dialogIsOpened, setDialogIsOpened] = useState(false);
  const [configDialogIsOpened, setConfigDialogIsOpened] = useState(false);

  let value = stringToBoolean(
    localStorage.getItem("user_has_kucoin_integration")
  );
  return (
    <>
      <Grid item xs={12}>
        <Grid container alignItems="center">
          <Grid item xs={4}>
            <Typography>KuCoin</Typography>
          </Grid>
          <Grid item xs={8}>
            {getButton(value, {
              onClick: () => setDialogIsOpened(true),
            })}
            <Button
              disabled={!value}
              startIcon={<SettingsIcon />}
              onClick={() => setConfigDialogIsOpened(true)}
            >
              Configurações
            </Button>
          </Grid>
        </Grid>
        <Divider />
      </Grid>
      {value ? (
        <DisableDialog
          userId={userId}
          disableData={{
            secrets: {
              kucoin_api_key: null,
              kucoin_api_secret: null,
              kucoin_api_passphrase: null,
            },
          }}
          integrationLabel="com a corretora KuCoin"
          open={dialogIsOpened}
          onClose={() => setDialogIsOpened(false)}
          onDisable={() =>
            localStorage.setItem("user_has_kucoin_integration", false)
          }
        />
      ) : (
        <ConfigDialog
          ConfigForm={KuCoinIntegrationConfigurationForm}
          integrationLabel="com a corretora KuCoin"
          userId={userId}
          open={dialogIsOpened}
          onClose={() => setDialogIsOpened(false)}
        />
      )}
      <ConfigDialog
        ConfigForm={KuCoinIntegrationConfigurationForm}
        integrationLabel="com a corretora KuCoin"
        userId={userId}
        open={configDialogIsOpened}
        onClose={() => setConfigDialogIsOpened(false)}
      />
    </>
  );
};

const BinanceIntegrationConfiguration = ({ userId }) => {
  const [dialogIsOpened, setDialogIsOpened] = useState(false);
  const [configDialogIsOpened, setConfigDialogIsOpened] = useState(false);

  let value = stringToBoolean(
    localStorage.getItem("user_has_binance_integration")
  );
  return (
    <>
      <Grid item xs={12}>
        <Grid container alignItems="center">
          <Grid item xs={4}>
            <Typography>Binance</Typography>
          </Grid>
          <Grid item xs={8}>
            {getButton(value, {
              onClick: () => setDialogIsOpened(true),
            })}
            <Button
              disabled={!value}
              startIcon={<SettingsIcon />}
              onClick={() => setConfigDialogIsOpened(true)}
            >
              Configurações
            </Button>
          </Grid>
        </Grid>
        <Divider />
      </Grid>
      {value ? (
        <DisableDialog
          userId={userId}
          disableData={{
            secrets: {
              binance_api_key: null,
              binance_api_secret: null,
            },
          }}
          integrationLabel="com a corretora Binance"
          open={dialogIsOpened}
          onClose={() => setDialogIsOpened(false)}
          onDisable={() =>
            localStorage.setItem("user_has_binance_integration", false)
          }
        />
      ) : (
        <ConfigDialog
          ConfigForm={BinanceIntegrationConfigurationForm}
          integrationLabel="com a corretora Binance"
          userId={userId}
          open={dialogIsOpened}
          onClose={() => setDialogIsOpened(false)}
        />
      )}
      <ConfigDialog
        ConfigForm={BinanceIntegrationConfigurationForm}
        integrationLabel="com a corretora Binance"
        userId={userId}
        open={configDialogIsOpened}
        onClose={() => setConfigDialogIsOpened(false)}
      />
    </>
  );
};

export const IntegrationsConfiguration = ({ userId }) => {
  return (
    <Grid container spacing={2}>
      <KucoinIntegrationConfiguration userId={userId} />
      <BinanceIntegrationConfiguration userId={userId} />
    </Grid>
  );
};
