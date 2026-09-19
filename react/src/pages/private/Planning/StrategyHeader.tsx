import type { ReactNode } from "react";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Link } from "react-router-dom";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";

type StrategyHeaderProps = {
  title: ReactNode;
  subtitle?: string;
  titleSize?: FontSizes;
  isActive: boolean;
  isMutating: boolean;
  onSelect: () => void;
  isDirty: boolean;
  onSave: () => void;
  actions?: ReactNode;
  sticky?: boolean;
  activeBadgeByTitle?: boolean;
};

const StrategyHeader = ({
  title,
  subtitle,
  titleSize = FontSizes.LARGE,
  isActive,
  isMutating,
  onSelect,
  isDirty,
  onSave,
  actions,
  sticky = false,
  activeBadgeByTitle = false,
}: StrategyHeaderProps) => (
  <>
    <Link
      to="/planning"
      style={{ textDecoration: "none", alignSelf: "flex-start" }}
    >
      <Button
        variant="text"
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: "none", color: getColor(Colors.neutral400) }}
      >
        Voltar
      </Button>
    </Link>

    <Stack
      role={sticky ? "region" : undefined}
      aria-label={sticky ? "Ações do cenário" : undefined}
      sx={
        sticky
          ? {
              position: "sticky",
              top: { xs: 56, sm: 64 },
              zIndex: 10,
              backgroundColor: getColor(Colors.neutral900),
            }
          : undefined
      }
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={1}
    >
      <Stack gap={0.5}>
        <Stack
          data-testid="strategy-title"
          direction="row"
          alignItems="center"
          gap={1}
        >
          <Text weight={FontWeights.SEMI_BOLD} size={titleSize}>
            {title}
          </Text>
          {isActive && activeBadgeByTitle && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Estratégia ativa"
              color="success"
              size="small"
            />
          )}
        </Stack>
        {subtitle && (
          <Text size={FontSizes.SMALL} color={Colors.neutral400}>
            {subtitle}
          </Text>
        )}
      </Stack>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        {actions}
        {isActive ? (
          <>
            {isDirty && (
              <Button
                color="success"
                variant="contained"
                size="small"
                onClick={onSave}
                disabled={isMutating}
              >
                Salvar alterações
              </Button>
            )}
            {!activeBadgeByTitle && (
              <Chip
                icon={<CheckCircleIcon />}
                label="Estratégia ativa"
                color="success"
                size="small"
              />
            )}
          </>
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={onSelect}
            disabled={isMutating}
          >
            Selecionar como ativa
          </Button>
        )}
      </Stack>
    </Stack>
  </>
);

export default StrategyHeader;
