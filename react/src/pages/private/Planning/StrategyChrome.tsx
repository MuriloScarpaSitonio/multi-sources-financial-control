import type { ReactNode } from "react";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
} from "../../../design-system";
import type { ProConItem } from "./strategyContent";

type StrategyChromeProps = {
  rationale: ReactNode;
  extraRationale?: ReactNode[];
  pros: ProConItem[];
  cons: ProConItem[];
};

const StrategyChrome = ({
  rationale,
  extraRationale = [],
  pros,
  cons,
}: StrategyChromeProps) => (
  <>
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Stack gap={2}>
        <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.MEDIUM}>
          Entenda a estratégia
        </Text>
        <Text size={FontSizes.SMALL} color={Colors.neutral400}>
          {rationale}
        </Text>
        {extraRationale.map((text, i) => (
          <Text
            key={`extra-${i}`}
            size={FontSizes.SMALL}
            color={Colors.neutral400}
            style={{ fontStyle: "italic" }}
          >
            {text}
          </Text>
        ))}
      </Stack>
    </Paper>

    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Stack direction="row" gap={4}>
        <Stack gap={1} flex={1}>
          <Text
            size={FontSizes.SMALL}
            weight={FontWeights.SEMI_BOLD}
            color={Colors.brand500}
          >
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
        <Stack gap={1} flex={1}>
          <Text
            size={FontSizes.SMALL}
            weight={FontWeights.SEMI_BOLD}
            color={Colors.danger200}
          >
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
    </Paper>
  </>
);

export default StrategyChrome;
