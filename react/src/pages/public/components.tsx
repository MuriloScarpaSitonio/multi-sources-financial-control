import { ReactNode } from "react";

import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";

import { theme } from "./styles";
import { Text } from "../../design-system/components";
import * as enums from "../../design-system/enums";
import {
  FacebookColoredIcon,
  GoogleColoredIcon,
} from "../../design-system/icons";
import { getColor } from "../../design-system/utils";

export const ImageAndTexts = ({ image }: { image: string }) => (
  <Stack sx={{ width: "50%" }}>
    <Stack sx={{ padding: "12px 96px" }} textAlign="center" alignItems="center">
      <img src={image} alt="login" width={400} height={400} />
      <Stack spacing={4}>
        <Text
          weight={enums.FontWeights.BOLD}
          size={enums.FontSizes.REGULAR}
          color={enums.Colors.neutral900}
        >
          Realize suas análises de forma fácil e segura.
        </Text>
        <Text
          weight={enums.FontWeights.LIGHT}
          size={enums.FontSizes.SMALL}
          color={enums.Colors.neutral500}
        >
          Mantenha suas informações em segurança e com monitoramento fácil.{" "}
          <Text
            weight={enums.FontWeights.LIGHT}
            size={enums.FontSizes.SMALL}
            color={enums.Colors.brand500}
            display="inline"
          >
            Junte-se a nós hoje mesmo
          </Text>{" "}
          e assuma o controle do seu futuro financeiro!
        </Text>
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
}) => (
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
      }}
    >
      <Stack
        sx={{ padding: !isDownSmallScreen ? "48px 144px" : "24px" }}
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
