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
  subtitle: string;
  isActive: boolean;
  isMutating: boolean;
  onSelect: () => void;
  isDirty: boolean;
  onSave: () => void;
};

const StrategyHeader = ({
  title,
  subtitle,
  isActive,
  isMutating,
  onSelect,
  isDirty,
  onSave,
}: StrategyHeaderProps) => (
  <>
    <Link to="/planning" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
      <Button
        variant="text"
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: "none", color: getColor(Colors.neutral400) }}
      >
        Voltar
      </Button>
    </Link>

    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack gap={0.5}>
        <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.LARGE}>
          {title}
        </Text>
        <Text size={FontSizes.SMALL} color={Colors.neutral400}>
          {subtitle}
        </Text>
      </Stack>
      {isActive ? (
        <Stack direction="row" gap={1} alignItems="center">
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
          <Chip
            icon={<CheckCircleIcon />}
            label="Estratégia ativa"
            color="success"
            size="small"
          />
        </Stack>
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
  </>
);

export default StrategyHeader;
