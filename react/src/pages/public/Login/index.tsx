import { useState } from "react";

import useMediaQuery from "@mui/material/useMediaQuery";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { ThemeProvider } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { login } from "../../../api/methods";
import { AccessTokenStr, RefreshTokenStr } from "../../../consts";
import { setUserDataToLocalStorage } from "../../../helpers.js";
import { FormFeedbackError, Text } from "../../../design-system/components";
import * as enums from "../../../design-system/enums";
import { getColor } from "../../../design-system/utils";
import loginSvg from "../assets/login.svg";
import { CallToActionSection, ImageAndTexts } from "../components";
import { theme } from "../styles";

const schema = yup.object().shape({
  email: yup
    .string()
    .email("Formato de e-mail inválido")
    .required("Campo obrigatório"),
  password: yup.string().required("Campo obrigatório"),
});

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
                <FormFeedbackError message={errors.email.message as string} />
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
                        color: getColor(enums.Colors.neutral300),
                        "&:hover": { color: getColor(enums.Colors.neutral0) },
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
                <FormFeedbackError
                  message={errors.password.message as string}
                />
              )}
              {!errors.password && isApiError && (
                <FormFeedbackError message="E-mail ou senha inválidos" />
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

const Login = () => {
  const isDownMediumScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <ThemeProvider theme={theme}>
      <Stack direction="row" sx={{ height: "100%" }}>
        <CallToActionSection
          title="Entre na sua conta para manter o controle do seu dinheiro."
          showButtons
          extraCtas={[
            {
              text: "Esqueci minha senha",
              url: "/forgot_password",
            },
          ]}
          footer={
            <>
              <Text
                weight={enums.FontWeights.SEMI_BOLD}
                size={enums.FontSizes.SMALL}
                color={enums.Colors.neutral300}
                align="center"
              >
                Não tem uma conta? Faça seu{" "}
                <Link color="inherit" href="/signup">
                  cadastro
                </Link>
              </Text>
            </>
          }
        >
          <LoginForm />
        </CallToActionSection>
        {!isDownMediumScreen && <ImageAndTexts image={loginSvg} />}
      </Stack>
    </ThemeProvider>
  );
};

export default Login;
