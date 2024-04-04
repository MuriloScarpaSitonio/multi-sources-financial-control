import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

import FormGroup from "@mui/material/FormGroup";
import TextField from "@mui/material/TextField";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { UserApi } from "../api";
import { FormFeedback } from "../components/FormFeedback";

const schema = yup.object().shape({
  username: yup.string().required("O nome de usuário é obrigatório"),
  email: yup.string().required("O email é obrigatório"),
});

export function UserProfileForm({ initialData }) {
  const [isLoaded, setIsLoaded] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertInfos, setAlertInfos] = useState({});

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
      new UserApi(initialData.userId)
        .patch(data)
        .then(() => {
          setAlertInfos({
            message: "Perfil atualizado com sucesso!",
            severity: "success",
          });
          setShowAlert(true);
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
            name="username"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                label="Nome de usuário"
                type="text"
                required
                style={{ width: "100%" }}
                error={!!errors.username}
                helperText={errors.username?.message}
                defaultValue={initialData.username}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                label="E-mail"
                type="text"
                required
                style={{ width: "100%" }}
                error={!!errors.email}
                helperText={errors.email?.message}
                defaultValue={initialData.email}
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
          {!isLoaded ? <CircularProgress size={24} /> : "Atualizar dados"}
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
