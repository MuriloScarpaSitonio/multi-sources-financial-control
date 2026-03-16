import { type ReactNode, useState } from "react";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";

export type ProConItem = { text: string; galeno?: boolean };

const MethodCard = ({
  title,
  subtitle,
  rationale,
  pros,
  cons,
  isSelected,
  onSelect,
  isSelectLoading,
  children,
}: {
  title: string;
  subtitle: string;
  rationale: string;
  pros: ProConItem[];
  cons: ProConItem[];
  isSelected: boolean;
  onSelect: () => void;
  isSelectLoading: boolean;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper
      elevation={isSelected ? 3 : 1}
      sx={{
        p: 3,
        borderRadius: 2,
        border: isSelected ? `2px solid ${getColor(Colors.brand)}` : "2px solid transparent",
      }}
    >
      <Stack gap={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack gap={0.5}>
            <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.MEDIUM}>
              {title}
            </Text>
            <Text size={FontSizes.SMALL} color={Colors.neutral400}>
              {subtitle}
            </Text>
          </Stack>
          {isSelected ? (
            <Chip
              icon={<CheckCircleIcon />}
              label="Método principal"
              color="success"
              size="small"
            />
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={onSelect}
              disabled={isSelectLoading}
            >
              Selecionar como principal
            </Button>
          )}
        </Stack>

        {children}

        <Stack gap={0.5}>
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {expanded ? "Ocultar fundamentação" : "Ver fundamentação"}
          </Button>
          <Collapse in={expanded}>
            <Stack gap={1.5}>
              <Text size={FontSizes.SMALL} color={Colors.neutral400}>
                {rationale}
              </Text>
              <Stack direction="row" gap={4}>
                <Stack gap={0.5} flex={1}>
                  <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD} color={Colors.brand500}>
                    Prós
                  </Text>
                  {pros.map((item) => (
                    <Text
                      key={item.text}
                      size={FontSizes.EXTRA_SMALL}
                      color={Colors.neutral400}
                      style={item.galeno ? { fontStyle: "italic" } : undefined}
                    >
                      + {item.galeno ? `[Galeno] ${item.text}` : item.text}
                    </Text>
                  ))}
                </Stack>
                <Stack gap={0.5} flex={1}>
                  <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD} color={Colors.danger200}>
                    Contras
                  </Text>
                  {cons.map((item) => (
                    <Text
                      key={item.text}
                      size={FontSizes.EXTRA_SMALL}
                      color={Colors.neutral400}
                      style={item.galeno ? { fontStyle: "italic" } : undefined}
                    >
                      − {item.galeno ? `[Galeno] ${item.text}` : item.text}
                    </Text>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Collapse>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default MethodCard;
