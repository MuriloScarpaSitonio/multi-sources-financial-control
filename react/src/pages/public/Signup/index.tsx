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
import { Controller } from "react-hook-form";
import * as yup from "yup";

import { signup } from "../../../api/methods";
import { FormFeedbackError, Text } from "../../../design-system/components";
import * as enums from "../../../design-system/enums";
import { getColor } from "../../../design-system/utils";
import otherSvg from "../assets/other.svg";
import { CallToActionSection, ImageAndTexts } from "../components";
import { useFormPlus } from "../hooks";
import { theme } from "../styles";

const schema = yup.object().shape({
  email: yup
    .string()
    .email("Formato de e-mail inválido")
    .required("Campo obrigatório"),
  username: yup.string().required("Campo obrigatório"),
  password: yup.string().required("Campo obrigatório"),
  password2: yup
    .string()
    .required("Campo obrigatório")
    .oneOf([yup.ref("password")], "As senhas precisam ser iguais"),
});

const SignupForm = ({
  onSuccess,
  setUserEmail,
}: {
  onSuccess: () => void;
  setUserEmail: (email: string) => void;
}) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPassword2, setShowPassword2] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
  } = useFormPlus({
    mutationFn: signup,
    schema,
    defaultValues: {
      email: "",
      username: "",
      password: "",
      password2: "",
    },
    onSuccess,
  });

  return (
    <form>
      <Stack spacing={2}>
        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <>
              <OutlinedInput
                {...field}
                required
                placeholder="Nome"
                size="small"
                label="Nome"
                error={isFieldInvalid(field)}
              />
              {getFieldHasError("username") && (
                <FormFeedbackError message={getErrorMessage("username")} />
              )}
            </>
          )}
        />
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <>
              <OutlinedInput
                {...field}
                required
                placeholder="E-mail"
                size="small"
                error={isFieldInvalid(field)}
              />
              {getFieldHasError("email") && (
                <FormFeedbackError message={getErrorMessage("email")} />
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
                size="small"
                error={isFieldInvalid(field, "password2")}
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
              {getFieldHasError("password") && (
                <FormFeedbackError message={getErrorMessage("password")} />
              )}
            </>
          )}
        />
        <Controller
          name="password2"
          control={control}
          render={({ field }) => (
            <>
              <OutlinedInput
                {...field}
                id="password2-input"
                required
                placeholder="Confirme sua senha"
                size="small"
                label="Confirme sua senha"
                error={isFieldInvalid(field, "password")}
                type={showPassword2 ? "text" : "password"}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      sx={{
                        color: getColor(enums.Colors.neutral300),
                        "&:hover": { color: getColor(enums.Colors.neutral0) },
                      }}
                      onClick={() => {
                        setShowPassword2((show) => !show);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword2 ? (
                        <VisibilityOffOutlinedIcon />
                      ) : (
                        <VisibilityOutlinedIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                }
              />
              {getFieldHasError("password2") && (
                <FormFeedbackError message={getErrorMessage("password2")} />
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
          onClick={handleSubmit((data) => {
            setUserEmail(data.email);
            mutate(data as any);
          })}
        >
          {!isPending ? (
            "Cadastre-se"
          ) : (
            <CircularProgress size={26} color="inherit" />
          )}
        </Button>
      </Stack>
    </form>
  );
};

const UserCreatedFeedback = ({ email }: { email: string }) => {
  return (
    <Stack spacing={3}>
      <Text
        weight={enums.FontWeights.BOLD}
        size={enums.FontSizes.SEMI_LARGE}
        align="center"
      >
        Verifique seu e-mail
      </Text>
      <Text align="center">
        Siga as instruções enviadas para{" "}
        <Text color={enums.Colors.brand400}>{email}</Text> e acesse sua conta
      </Text>
    </Stack>
  );
};

export const Signup = () => {
  const [isUserCreated, setIsUserCreated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const isDownMediumScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <ThemeProvider theme={theme}>
      <Stack direction="row">
        <CallToActionSection
          title={
            !isUserCreated
              ? "Cadastre-se agora para ficar no controle do seu dinheiro."
              : ""
          }
          showButtons={!isUserCreated}
          footer={
            <>
              <Text
                weight={enums.FontWeights.SEMI_BOLD}
                size={enums.FontSizes.SMALL}
                color={enums.Colors.neutral300}
                align="center"
              >
                {isUserCreated
                  ? "Voltar a página de "
                  : "Já tem uma conta? Faça seu "}
                <Link color="inherit" href="/">
                  Log in
                </Link>
              </Text>
            </>
          }
        >
          {isUserCreated ? (
            <UserCreatedFeedback email={userEmail} />
          ) : (
            <SignupForm
              setUserEmail={setUserEmail}
              onSuccess={() => {
                setIsUserCreated(true);
              }}
            />
          )}
        </CallToActionSection>
        {!isDownMediumScreen && <ImageAndTexts image={otherSvg} />}
      </Stack>
    </ThemeProvider>
  );
};

export default Signup;
