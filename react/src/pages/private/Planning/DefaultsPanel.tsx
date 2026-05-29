import { useState, type ReactNode } from "react";

import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import type { DefaultExplained } from "./strategyContent";

type DefaultsPanelProps = {
  items: DefaultExplained[];
  extra?: ReactNode;
};

const DefaultsPanel = ({ items, extra }: DefaultsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Entenda esses valores
      </Button>
      <Collapse in={expanded}>
        <Stack gap={2} mt={1}>
          {items.map((item) => (
            <Stack key={item.label} gap={0.5}>
              <Text size={FontSizes.SMALL} weight={FontWeights.MEDIUM}>
                {item.label}
              </Text>
              <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
                {item.explanation}
              </Text>
            </Stack>
          ))}
          {extra && (
            <Stack
              mt={2}
              sx={{
                pt: 2,
                borderTop: "1px solid",
                borderColor: getColor(Colors.neutral400),
              }}
            >
              {extra}
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default DefaultsPanel;
