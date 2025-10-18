import { ReactNode } from "react";

import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";

import { Text } from "../../design-system/components";
import * as enums from "../../design-system/enums";
import {
  FacebookColoredIcon,
  GoogleColoredIcon,
} from "../../design-system/icons";
import { getColor } from "../../design-system/utils";
import { theme } from "./styles";

export const ImageAndTexts = ({ image }: { image: string }) => (
  <Stack sx={{ width: "50%" }}>
    <Stack
      sx={{ padding: "12px 96px", marginBlock: "auto" }}
      textAlign="center"
      alignItems="center"
    >
      <img src={image} alt="login" width={400} height={400} />
      <Stack spacing={4}>
        <Text
          weight={enums.FontWeights.BOLD}
          size={enums.FontSizes.REGULAR}
          color={enums.Colors.neutral900}
        >
          Realize suas análises de forma fácil e segura.
        </Text>
        <Stack spacing={0.1} alignItems="center">
          <Text
            weight={enums.FontWeights.LIGHT}
            size={enums.FontSizes.SMALL}
            color={enums.Colors.neutral400}
          >
            Mantenha suas informações em segurança e com monitoramento fácil.
          </Text>
          <Text
            weight={enums.FontWeights.LIGHT}
            size={enums.FontSizes.SMALL}
            color={enums.Colors.neutral400}
          >
            <Text
              weight={enums.FontWeights.LIGHT}
              size={enums.FontSizes.SMALL}
              color={enums.Colors.brand500}
              display="inline"
            >
              Junte-se a nós hoje mesmo
            </Text>
            {" e assuma o controle do seu futuro financeiro!"}
          </Text>
        </Stack>
      </Stack>
    </Stack>
  </Stack>
);

const SocialButtons = ({
  isUpBigScreen,
  isDownSmallScreen,
}: {
  isUpBigScreen: boolean;
  isDownSmallScreen: boolean;
}) => {
  // Show icon-only buttons below xl breakpoint (1536px) to prevent text wrapping
  const showIconOnly = useMediaQuery(theme.breakpoints.down("xl"));

  return (
    <Stack
      direction={isDownSmallScreen ? "column" : "row"}
      justifyContent={showIconOnly ? "center" : "space-between"}
      spacing={2}
    >
      <Button
        startIcon={showIconOnly ? undefined : <GoogleColoredIcon />}
        variant="outlined"
        color="success"
        fullWidth={showIconOnly ? false : isUpBigScreen}
      >
        {showIconOnly ? <GoogleColoredIcon /> : "Entre com Google"}
      </Button>
      <Button
        startIcon={showIconOnly ? undefined : <FacebookColoredIcon />}
        variant="outlined"
        color="success"
        fullWidth={showIconOnly ? false : isUpBigScreen}
      >
        {showIconOnly ? <FacebookColoredIcon /> : "Entre com Facebook"}
      </Button>
    </Stack>
  );
};

export const CallToActionSection = ({
  children,
  title,
  showButtons = false,
  extraCtas,
  footer,
}: {
  children: ReactNode;
  title: string;
  showButtons?: boolean;
  extraCtas?: {
    text: string;
    url: string;
  }[];
  footer?: ReactNode;
}) => {
  const isUpBigScreen = useMediaQuery(theme.breakpoints.up("xl"));
  const isDownMediumScreen = useMediaQuery(theme.breakpoints.down("md"));
  const isDownSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Stack
      sx={{
        background: getColor(enums.Colors.neutral900),
        width: isDownMediumScreen ? "100%" : "50%",
        minHeight: "100vh",
        justifyContent: "center",
      }}
    >
      <Stack
        sx={{
          padding: {
            xs: "24px",
            sm: "32px 48px",
            lg: "48px 144px",
          },
        }}
        spacing={4}
      >
        <Text weight={enums.FontWeights.BOLD} align="center">
          {title}
        </Text>
        {showButtons && (
          <>
            <SocialButtons
              isUpBigScreen={isUpBigScreen}
              isDownSmallScreen={isDownSmallScreen}
            />
            <Divider>ou com email</Divider>
          </>
        )}
        {children}
        <Stack spacing={2}>
          {extraCtas?.map((cta) => (
            <Text
              weight={enums.FontWeights.SEMI_BOLD}
              size={enums.FontSizes.SMALL}
              color={enums.Colors.neutral300}
              extraStyle={{ textDecoration: "underline" }}
              align="center"
              key={`${cta.url}-${cta.text}`}
            >
              <Link color="inherit" href={cta.url}>
                {cta.text}
              </Link>
            </Text>
          ))}
          {footer}
        </Stack>
      </Stack>
    </Stack>
  );
};
