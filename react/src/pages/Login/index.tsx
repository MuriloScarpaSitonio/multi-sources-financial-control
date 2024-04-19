import { useState } from "react";

import Button, { buttonClasses } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import OutlinedInput, {
  outlinedInputClasses,
} from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Divider, FormHelperText } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { login } from "../../api/methods";
import { AccessTokenStr, RefreshTokenStr } from "../../consts";
import { setUserDataToLocalStorage } from "../../helpers.js";
import { COLORS } from "../../design-system/colors";
import { FacebookColoredIcon, GoogleColoredIcon } from "./layout";
import loginSvg from "./assets/login.svg";

const schema = yup.object().shape({
  email: yup
    .string()
    .email("Insira um email válido")
    .required("Campo obrigatório"),
  password: yup.string().required("Campo obrigatório"),
});

const theme = createTheme({
  // typography: {
  //   button: {
  //     fontSize: 14,
  //     // fontWeight: 400,
  //   },
  // },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: {
          color: COLORS.neutral1000,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          [`&.${buttonClasses.outlined}.${buttonClasses.colorSuccess}`]: {
            borderRadius: "5px",
            border: `2px solid ${COLORS.brand}`,
            color: COLORS.neutral1000,
            textTransform: "none",
            padding: "12px",
            "&:hover": {
              border: `2px solid ${COLORS.brand100}`,
            },
          },
          [`&.${buttonClasses.contained}.${buttonClasses.colorSuccess}`]: {
            borderRadius: "5px",
            background: COLORS.brand,
            color: COLORS.neutral900,
            textTransform: "none",
            "&:hover": {
              background: COLORS.brand200,
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          color: COLORS.neutral1000,
          "&::before, &::after": {
            backgroundColor: COLORS.neutral1000,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: "5px",
          border: `2px solid ${COLORS.brand}`,
          input: {
            color: COLORS.neutral700,
            "&::placeholder": {
              color: COLORS.neutral700,
            },
          },
          "&:hover": {
            border: `2px solid ${COLORS.brand100}`,
            "& input": {
              color: COLORS.neutral0,
            },
            "& input::placeholder": {
              color: COLORS.neutral0,
            },
          },
          "& > fieldset": {
            border: "none",
          },
          [`&.${outlinedInputClasses.error}`]: {
            borderRadius: "5px",
            border: `2px solid ${COLORS.danger200}`,
            "&:hover": {
              border: `2px solid ${COLORS.danger100}`,
              "& input::placeholder": {
                color: COLORS.neutral0,
              },
            },
          },
          [`&.${outlinedInputClasses.focused}.${outlinedInputClasses.error}`]: {
            borderRadius: "5px",
            border: `2px solid ${COLORS.danger200}`,
          },
          [`&.${outlinedInputClasses.focused}`]: {
            borderRadius: "5px",
            border: `2px solid ${COLORS.brand}`,
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: COLORS.neutral700,
        },
      },
    },
  },
});

export const Login = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    // reValidateMode: "onSubmit",
  });

  const navigate = useNavigate();

  const {
    mutate,
    isPending,
    isError: isApiError,
  } = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      localStorage.setItem(RefreshTokenStr, response.data.refresh);
      localStorage.setItem(AccessTokenStr, response.data.access);
      setUserDataToLocalStorage(response.data.user);
      if (response.data.user.subscription_status === "CANCELED")
        navigate("/subscription");
      else navigate("/home");
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <Stack direction="row" sx={{ height: "100%" }}>
        <Stack sx={{ background: COLORS.neutral900, width: "50%" }}>
          {/* <Stack sx={{ padding: "192px 144px" }} spacing={4}> */}
          <Stack sx={{ padding: "48px 144px" }} spacing={4}>
            <Typography
              align="center"
              style={{ fontWeight: 800, fontSize: 24 }}
            >
              Entre na sua conta para manter o controle do seu dinheiro.
            </Typography>
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Button
                startIcon={<GoogleColoredIcon />}
                variant="outlined"
                color="success"
              >
                Entre com Google
              </Button>
              <Button
                startIcon={<FacebookColoredIcon />}
                variant="outlined"
                color="success"
              >
                Entre com Facebook
              </Button>
            </Stack>
            <Divider>ou com email</Divider>
            <form>
              <Stack spacing={2}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <>
                      <OutlinedInput
                        {...field}
                        required
                        placeholder="E-mail"
                        error={!!errors.email || isApiError}
                      />
                      {!!errors.email && (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <InfoOutlinedIcon
                            style={{ color: COLORS.danger200 }}
                          />
                          <FormHelperText>
                            {errors.email?.message}
                          </FormHelperText>
                        </Stack>
                      )}
                    </>
                  )}
                />
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <>
                      <OutlinedInput
                        {...field}
                        required
                        placeholder="Senha"
                        error={isApiError}
                        type={showPassword ? "text" : "password"}
                        endAdornment={
                          <InputAdornment position="end">
                            <IconButton
                              sx={{
                                color: COLORS.neutral700,
                                "&:hover": { color: COLORS.neutral0 },
                              }}
                              onClick={() => {
                                setShowPassword((show) => !show);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              edge="end"
                            >
                              {showPassword ? (
                                <VisibilityOffOutlinedIcon />
                              ) : (
                                <VisibilityOutlinedIcon />
                              )}
                            </IconButton>
                          </InputAdornment>
                        }
                      />

                      {isApiError && (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <InfoOutlinedIcon
                            style={{ color: COLORS.danger200 }}
                          />
                          <FormHelperText>
                            E-mail ou senha inválidos
                          </FormHelperText>
                        </Stack>
                      )}
                    </>
                  )}
                />
                <Button
                  color="success"
                  variant="contained"
                  size="large"
                  fullWidth
                  type="submit"
                  onClick={handleSubmit((data) => mutate(data as any))}
                >
                  {!isPending ? (
                    "Entrar"
                  ) : (
                    <CircularProgress size={26} color="inherit" />
                  )}
                </Button>
              </Stack>
            </form>
            <Stack spacing={2}>
              <Typography
                align="center"
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  textDecoration: "underline",
                  color: COLORS.neutral700,
                }}
              >
                <Link color="inherit" href="/forgot_password">
                  Esqueci a senha
                </Link>
              </Typography>
              <Typography
                align="center"
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  // textDecoration: "underline",
                  color: COLORS.neutral700,
                }}
              >
                Não tem uma conta? Faça seu{" "}
                <Link color="inherit" href="/signup">
                  cadastro
                </Link>
              </Typography>
            </Stack>
          </Stack>
        </Stack>
        <Stack sx={{ width: "50%" }}>
          {/* <Stack sx={{ padding: "36px 96px" }}>
            <img src={loginSvg} alt="login" width={556} height={556} /> */}
          <Stack sx={{ padding: "12px 96px" }}>
            <img
              src={loginSvg}
              alt="login"
              style={{ marginLeft: 36 }}
              width={400}
              height={400}
            />
            <Stack spacing={4}>
              <Typography
                align="center"
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  color: COLORS.neutral900,
                }}
              >
                Realize suas análises de forma fácil e segura.
              </Typography>
              <Typography
                align="center"
                style={{
                  fontWeight: 400,
                  fontSize: 16,
                  color: COLORS.neutral300,
                }}
              >
                Mantenha suas informações em segurança e com monitoramento
                fácil.{" "}
                <Typography
                  display="inline"
                  style={{
                    fontWeight: 400,
                    fontSize: 16,
                    color: COLORS.brand500,
                  }}
                >
                  Junte-se a nós hoje mesmo
                </Typography>{" "}
                e assuma o controle do seu futuro financeiro!
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </ThemeProvider>
  );
};
