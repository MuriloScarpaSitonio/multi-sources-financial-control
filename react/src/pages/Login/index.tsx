import { FunctionComponent, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
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
    .email("Formato de e-mail inválido")
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
          color: COLORS.neutral0,
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
            color: COLORS.neutral0,
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
          color: COLORS.neutral0,
          "&::before, &::after": {
            backgroundColor: COLORS.neutral0,
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
            color: COLORS.neutral300,
            "&::placeholder": {
              color: COLORS.neutral300,
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
            background: COLORS.neutral700,
          },
          [`&.${outlinedInputClasses.focused}`]: {
            borderRadius: "5px",
            border: `2px solid ${COLORS.brand}`,
            background: COLORS.neutral700,
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: COLORS.neutral300,
        },
      },
    },
  },
});

const SocialButtons: FunctionComponent<{
  isUpBigScreen: boolean;
  isDownSmallScreen: boolean;
}> = ({ isUpBigScreen, isDownSmallScreen }) => (
  <Stack
    direction={isDownSmallScreen ? "column" : "row"}
    justifyContent="space-between"
    spacing={2}
  >
    <Button
      startIcon={<GoogleColoredIcon />}
      variant="outlined"
      color="success"
      fullWidth={isUpBigScreen}
    >
      Entre com Google
    </Button>
    <Button
      startIcon={<FacebookColoredIcon />}
      variant="outlined"
      color="success"
      fullWidth={isUpBigScreen}
    >
      Entre com Facebook
    </Button>
  </Stack>
);

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
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
                error={!!errors.email || (isApiError && isSubmitSuccessful)}
              />
              {!!errors.email && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoOutlinedIcon style={{ color: COLORS.danger200 }} />
                  <FormHelperText>{errors.email?.message}</FormHelperText>
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
                error={!!errors.password || isApiError}
                type={showPassword ? "text" : "password"}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      sx={{
                        color: COLORS.neutral300,
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
              {!!errors.password && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoOutlinedIcon style={{ color: COLORS.danger200 }} />
                  <FormHelperText>{errors.password?.message}</FormHelperText>
                </Stack>
              )}
              {!errors.password && isApiError && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoOutlinedIcon style={{ color: COLORS.danger200 }} />
                  <FormHelperText>E-mail ou senha inválidos</FormHelperText>
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
  );
};

const ImageAndTexts = () => (
  <Stack sx={{ width: "50%" }}>
    {/* <Stack sx={{ padding: "36px 96px" }}>
            <img src={loginSvg} alt="login" width={556} height={556} /> */}
    <Stack sx={{ padding: "12px 96px" }} textAlign="center" alignItems="center">
      <img src={loginSvg} alt="login" width={400} height={400} />
      <Stack spacing={4}>
        <Typography
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: COLORS.neutral900,
          }}
        >
          Realize suas análises de forma fácil e segura.
        </Typography>
        <Typography
          style={{
            fontWeight: 400,
            fontSize: 16,
            color: COLORS.neutral500,
          }}
        >
          Mantenha suas informações em segurança e com monitoramento fácil.{" "}
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
);

export const Login = () => {
  const isUpBigScreen = useMediaQuery(theme.breakpoints.up("xl"));
  const isDownMediumScreen = useMediaQuery(theme.breakpoints.down("md"));
  const isDownSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <ThemeProvider theme={theme}>
      <Stack direction="row" sx={{ height: "100vh" }}>
        <Stack
          sx={{
            background: COLORS.neutral900,
            width: isDownMediumScreen ? "100%" : "50%",
          }}
        >
          <Stack
            sx={{ padding: !isDownSmallScreen ? "48px 144px" : "24px" }}
            spacing={4}
          >
            <Typography
              align="center"
              style={{ fontWeight: 800, fontSize: 24 }}
            >
              Entre na sua conta para manter o controle do seu dinheiro.
            </Typography>
            <SocialButtons
              isUpBigScreen={isUpBigScreen}
              isDownSmallScreen={isDownSmallScreen}
            />
            <Divider>ou com email</Divider>
            <LoginForm />
            <Stack spacing={2}>
              <Typography
                align="center"
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  textDecoration: "underline",
                  color: COLORS.neutral300,
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
                  color: COLORS.neutral300,
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
        {!isDownMediumScreen && <ImageAndTexts />}
      </Stack>
    </ThemeProvider>
  );
};
