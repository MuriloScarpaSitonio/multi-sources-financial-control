import { useState } from "react";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";

import DialogActions from "@material-ui/core/DialogActions";
import FormGroup from "@material-ui/core/FormGroup";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import TextField from "@material-ui/core/TextField";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { UserApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

const schema = yup.object().shape({
  kucoin_api_key: yup.string().required("API key é um campo obrigatório"),
  kucoin_api_secret: yup.string().required("API secret é um campo obrigatório"),
  kucoin_api_passphrase: yup
    .string()
    .required("API passphrase é um campo obrigatório"),
});

export const KuCoinIntegrationConfigurationForm = ({ userId, handleClose }) => {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});
  const [showApiKeyPassword, setShowApiKeyPassword] = useState(false);
  const [showApiSecretPassword, setShowApiSecretPassword] = useState(false);
  const [showApiPassPhrasePassword, setShowApiPassphrasePassword] =
    useState(false);

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
          localStorage.setItem("user_has_kucoin_integration", true);
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
            name="kucoin_api_key"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="KuCoin API key"
                type={showApiKeyPassword ? "text" : "password"}
                required
                style={{ width: "100%" }}
                error={!!errors.kucoin_api_key}
                helperText={errors.kucoin_api_key?.message}
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
            name="kucoin_api_secret"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="KuCoin API secret"
                type={showApiSecretPassword ? "text" : "password"}
                required
                style={{ width: "100%" }}
                error={!!errors.kucoin_api_secret}
                helperText={errors.kucoin_api_secret?.message}
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
          <Controller
            name="kucoin_api_passphrase"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                label="KuCoin API passphrase"
                type={showApiPassPhrasePassword ? "text" : "password"}
                required
                style={{ width: "100%" }}
                error={!!errors.kucoin_api_passphrase}
                helperText={errors.kucoin_api_passphrase?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() =>
                          setShowApiPassphrasePassword(
                            !showApiPassPhrasePassword
                          )
                        }
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showApiPassPhrasePassword ? (
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
