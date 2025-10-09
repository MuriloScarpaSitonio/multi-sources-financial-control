import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormHelperText from "@mui/material/FormHelperText";
import Link from "@mui/material/Link";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import { ThemeProvider } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Controller } from "react-hook-form";
import * as yup from "yup";

import { forgotPassword } from "../../../api/methods";
import { FormFeedbackError, Text } from "../../../design-system/components";
import * as enums from "../../../design-system/enums";
import useFormPlus from "../../../hooks/useFormPlus";
import otherSvg from "../assets/other.svg";
import { CallToActionSection, ImageAndTexts } from "../components";
import { theme } from "../styles";

const schema = yup.object().shape({
  email: yup
    .string()
    .email("Formato de e-mail inválido")
    .required("Campo obrigatório"),
});

const ForgotPasswordForm = ({
  onSuccess,
  setUserEmail,
}: {
  onSuccess: () => void;
  setUserEmail: (email: string) => void;
}) => {
  const {
    control,
    handleSubmit,
    mutate,
    isPending,
    isFieldInvalid,
    getFieldHasError,
    getErrorMessage,
  } = useFormPlus({
    mutationFn: forgotPassword,
    schema,
    defaultValues: { email: "" },
    onSuccess,
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
                error={isFieldInvalid(field)}
              />

              {getFieldHasError("email") ? (
                <FormFeedbackError message={getErrorMessage("email")} />
              ) : (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <FormHelperText>
                    Um link para definir uma nova senha será enviado para este
                    email, se ele existir no nosso banco de dados
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
          onClick={handleSubmit((data) => {
            setUserEmail(data.email);
            mutate(data.email);
          })}
        >
          {!isPending ? (
            "Enviar"
          ) : (
            <CircularProgress size={26} color="inherit" />
          )}
        </Button>
      </Stack>
    </form>
  );
};

const ForgotPasswordFeeback = ({ email }: { email: string }) => {
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
        <Text color={enums.Colors.brand400}>{email}</Text> e defina uma nova
        senha
      </Text>
    </Stack>
  );
};

const ForgotPassword = () => {
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const isDownMediumScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <ThemeProvider theme={theme}>
      <Stack direction="row" sx={{ height: "100vh" }}>
        <CallToActionSection
          title={!isSuccess ? "Esqueci minha senha" : ""}
          footer={
            <>
              <Text
                weight={enums.FontWeights.SEMI_BOLD}
                size={enums.FontSizes.SMALL}
                color={enums.Colors.neutral300}
                align="center"
              >
                {isSuccess
                  ? "Voltar a página de "
                  : "Lembrou da senha? Faça seu "}
                <Link color="inherit" href="/">
                  Log in
                </Link>
              </Text>
            </>
          }
        >
          {isSuccess ? (
            <ForgotPasswordFeeback email={userEmail} />
          ) : (
            <ForgotPasswordForm
              setUserEmail={setUserEmail}
              onSuccess={() => {
                setIsSuccess(true);
              }}
            />
          )}
        </CallToActionSection>
        {!isDownMediumScreen && <ImageAndTexts image={otherSvg} />}
      </Stack>
    </ThemeProvider>
  );
};

export default ForgotPassword;
