import { useState } from "react";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Link from "@material-ui/core/Link";
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
  old_password: yup.string().min(4).required("Campo obrigatório"),
  password: yup.string().min(4).required("Campo obrigatório"),
  password2: yup
    .string()
    .min(4)
    .oneOf([yup.ref("password"), null], "As senhas precisam ser iguais"),
});

export function ChangePasswordForm() {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    mode: "all",
    resolver: yupResolver(schema),
  });

  const onSubmit = (data) => {
    if (isDirty) {
      setIsLoaded(false);
      new UserApi()
        .changePassword(data)
        .then(() => {
          setAlertInfos({
            message: "Senha atualizada com sucesso!",
            severity: "success",
          });
          reset();
          setShowAlert(true);
        })
        .catch((error) => {
          setAlertInfos({
            message: JSON.stringify(error.response.data),
            severity: "error",
          });
          reset();
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
            name="old_password"
            id="old_password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                label="Senha antiga"
                type={showOldPassword ? "text" : "password"}
                error={!!errors.old_password}
                helperText={
                  errors.old_password?.message || (
                    <div>
                      Esqueceu sua senha?{" "}
                      <Link href="/forgot_password">Defina uma nova</Link>
                    </div>
                  )
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showOldPassword ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
          <Controller
            name="password"
            id="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                label="Nova senha"
                type={showPassword ? "text" : "password"}
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {showPassword ? <Visibility /> : <VisibilityOff />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
          <Controller
            name="password2"
            id="password2"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                label="Nova senha (de novo)"
                type={showPassword ? "text" : "password"}
                error={!!errors.password2}
                helperText={errors.password2?.message}
              />
            )}
          />
        </FormGroup>
        <Button
          onClick={handleSubmit(onSubmit)}
          color="primary"
          variant={isLoaded && "contained"}
          size="small"
        >
          {!isLoaded ? <CircularProgress size={24} /> : "Atualizar senha"}
        </Button>
      </form>
      <FormFeedback
        open={showAlert}
        onClose={() => setShowAlert(false)}
        message={alertInfos.message}
        severity={alertInfos.severity}
      />
    </>
  );
}
