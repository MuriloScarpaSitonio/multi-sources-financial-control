import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { enqueueSnackbar } from "notistack";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { apiProvider } from "../../../api/methods";
import { Colors, FontWeights, Text, getColor } from "../../../design-system";
import { setUserDataToLocalStorage } from "../../../helpers";

const RESOURCE = "users";
const getUserId = () => localStorage.getItem("user_id");

const profileSchema = yup.object().shape({
  username: yup.string().required("O nome de usuário é obrigatório"),
  email: yup.string().required("O email é obrigatório"),
  date_of_birth: yup.string(),
});

const passwordSchema = yup.object().shape({
  old_password: yup.string().min(4).required("Campo obrigatório"),
  password: yup.string().min(4).required("Campo obrigatório"),
  password2: yup
    .string()
    .min(4)
    .oneOf([yup.ref("password"), ""], "As senhas precisam ser iguais"),
});

const formatDateForApi = (isoDate: string) => {
  if (!isoDate) return undefined;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const paperSx = {
  p: 3,
  borderRadius: 3,
  backgroundColor: getColor(Colors.neutral800),
};

const textFieldSx = {
  "& .MuiInputLabel-root": { color: getColor(Colors.neutral400) },
  "& .MuiInputBase-input": { color: getColor(Colors.neutral0) },
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: getColor(Colors.neutral600) },
    "&:hover fieldset": { borderColor: getColor(Colors.neutral400) },
  },
};

const ProfileForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    mode: "all",
    resolver: yupResolver(profileSchema),
  });

  const onSubmit = async (data: Record<string, string>) => {
    if (!isDirty) {
      enqueueSnackbar("Você precisa alterar pelo menos um campo!", { variant: "error" });
      return;
    }
    setIsSubmitting(true);
    const payload = { ...data };
    if (payload.date_of_birth) {
      payload.date_of_birth = formatDateForApi(payload.date_of_birth)!;
    } else {
      delete payload.date_of_birth;
    }
    try {
      const { data: responseData } = await apiProvider.patch(
        `${RESOURCE}/${getUserId()}`,
        payload,
      );
      setUserDataToLocalStorage(responseData);
      enqueueSnackbar("Perfil atualizado com sucesso!", { variant: "success" });
    } catch (error: any) {
      enqueueSnackbar(JSON.stringify(error.response?.data), { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper elevation={0} sx={paperSx}>
      <Text weight={FontWeights.SEMI_BOLD} color={Colors.neutral0}>
        Meus dados
      </Text>
      <Stack spacing={2} mt={2}>
        <Controller
          name="username"
          control={control}
          defaultValue={localStorage.getItem("user_username") ?? ""}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nome de usuário"
              size="small"
              error={!!errors.username}
              helperText={errors.username?.message}
              sx={textFieldSx}
            />
          )}
        />
        <Controller
          name="email"
          control={control}
          defaultValue={localStorage.getItem("user_email") ?? ""}
          render={({ field }) => (
            <TextField
              {...field}
              label="E-mail"
              size="small"
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={textFieldSx}
            />
          )}
        />
        <Controller
          name="date_of_birth"
          control={control}
          defaultValue={localStorage.getItem("user_date_of_birth") ?? ""}
          render={({ field }) => (
            <TextField
              {...field}
              label="Data de nascimento"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={textFieldSx}
            />
          )}
        />
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="brand"
          size="small"
          sx={{ alignSelf: "flex-start" }}
        >
          {isSubmitting ? <CircularProgress size={20} /> : "Atualizar dados"}
        </Button>
      </Stack>
    </Paper>
  );
};

const ChangePasswordForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    mode: "all",
    resolver: yupResolver(passwordSchema),
  });

  const onSubmit = async (data: Record<string, string>) => {
    if (!isDirty) {
      enqueueSnackbar("Você precisa alterar pelo menos um campo!", { variant: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiProvider.patch(`${RESOURCE}/change_password`, data);
      enqueueSnackbar("Senha atualizada com sucesso!", { variant: "success" });
      reset();
    } catch (error: any) {
      enqueueSnackbar(JSON.stringify(error.response?.data), { variant: "error" });
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordAdornment = (show: boolean, toggle: () => void) => (
    <InputAdornment position="end">
      <IconButton onClick={toggle} onMouseDown={(e) => e.preventDefault()} size="small">
        {show ? (
          <Visibility sx={{ color: getColor(Colors.neutral400) }} />
        ) : (
          <VisibilityOff sx={{ color: getColor(Colors.neutral400) }} />
        )}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Paper elevation={0} sx={paperSx}>
      <Text weight={FontWeights.SEMI_BOLD} color={Colors.neutral0}>
        Alterar senha
      </Text>
      <Stack spacing={2} mt={2}>
        <Controller
          name="old_password"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <TextField
              {...field}
              label="Senha antiga"
              type={showOldPassword ? "text" : "password"}
              size="small"
              error={!!errors.old_password}
              helperText={
                errors.old_password?.message || (
                  <span>
                    Esqueceu sua senha?{" "}
                    <Link href="/forgot_password" sx={{ color: getColor(Colors.brand) }}>
                      Defina uma nova
                    </Link>
                  </span>
                )
              }
              slotProps={{
                input: {
                  endAdornment: passwordAdornment(showOldPassword, () =>
                    setShowOldPassword(!showOldPassword),
                  ),
                },
              }}
              sx={textFieldSx}
            />
          )}
        />
        <Controller
          name="password"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <TextField
              {...field}
              label="Nova senha"
              type={showPassword ? "text" : "password"}
              size="small"
              error={!!errors.password}
              helperText={errors.password?.message}
              slotProps={{
                input: {
                  endAdornment: passwordAdornment(showPassword, () =>
                    setShowPassword(!showPassword),
                  ),
                },
              }}
              sx={textFieldSx}
            />
          )}
        />
        <Controller
          name="password2"
          control={control}
          defaultValue=""
          render={({ field }) => (
            <TextField
              {...field}
              label="Nova senha (de novo)"
              type={showPassword ? "text" : "password"}
              size="small"
              error={!!errors.password2}
              helperText={errors.password2?.message}
              sx={textFieldSx}
            />
          )}
        />
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="brand"
          size="small"
          sx={{ alignSelf: "flex-start" }}
        >
          {isSubmitting ? <CircularProgress size={20} /> : "Atualizar senha"}
        </Button>
      </Stack>
    </Paper>
  );
};

const User = () => {
  return (
    <Stack spacing={3} pb={3}>
      <Text weight={FontWeights.SEMI_BOLD}>Minha conta</Text>
      <Stack direction="row" spacing={3}>
        <Stack sx={{ flex: 1 }}>
          <ProfileForm />
        </Stack>
        <Stack sx={{ flex: 1 }}>
          <ChangePasswordForm />
        </Stack>
      </Stack>
    </Stack>
  );
};

export default User;
