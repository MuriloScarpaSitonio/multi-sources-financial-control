import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

import DialogActions from "@mui/material/DialogActions";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { UserApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

const schema = yup.object().shape({
  binance_api_key: yup.string().required("API key é um campo obrigatório"),
  binance_api_secret: yup
    .string()
    .required("API secret é um campo obrigatório"),
});

export const BinanceIntegrationConfigurationForm = ({
  userId,
  handleClose,
}) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});
  const [showApiKeyPassword, setShowApiKeyPassword] = useState(false);
  const [showApiSecretPassword, setShowApiSecretPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });

  const onSubmit = (data) => {
    if (isDirty) {
      setIsLoaded(false);
      new UserApi(userId)
        .patch({ secrets: data })
        .then(() => {
          localStorage.setItem("user_has_binance_integration", true);
          setAlertInfos({
            message: "Configurações atualizadas com sucesso!",
            severity: "success",
          });
          setShowAlert(true);
          handleClose();
        })
        .catch((error) => {
          setAlertInfos({
            message: JSON.stringify(error.response.data),
            severity: "error",
          });
          setShowAlert(true);
        })
        .finally(() => setIsLoaded(true));
      return;
    }
    setAlertInfos({
      message: "Você precisa alterar pelo menos um campo!",
      severity: "error",
    });
    setShowAlert(true);
  };
  return (
    <>
      <form>
        <FormGroup row>
          <Controller
            name="binance_api_key"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Binance API key"
                type={showApiKeyPassword ? "text" : "password"}
                required
                style={{ width: "100%" }}
                error={!!errors.binance_api_key}
                helperText={errors.binance_api_key?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() =>
                          setShowApiKeyPassword(!showApiKeyPassword)
                        }
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showApiKeyPassword ? (
                          <Visibility />
                        ) : (
                          <VisibilityOff />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
          <Controller
            name="binance_api_secret"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Binance API secret"
                type={showApiSecretPassword ? "text" : "password"}
                required
                style={{ width: "100%" }}
                error={!!errors.binance_api_secret}
                helperText={errors.binance_api_secret?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() =>
                          setShowApiSecretPassword(!showApiSecretPassword)
                        }
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showApiSecretPassword ? (
                          <Visibility />
                        ) : (
                          <VisibilityOff />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
        </FormGroup>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} color="primary">
            {!isLoaded ? <CircularProgress size={24} /> : "Atualizar"}
          </Button>
        </DialogActions>
      </form>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
};
