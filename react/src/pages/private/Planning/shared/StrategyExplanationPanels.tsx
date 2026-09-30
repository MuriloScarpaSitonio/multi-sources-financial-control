import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";

import { Colors, FontSizes, Text } from "../../../../design-system";
import DefaultsPanel from "../DefaultsPanel";

const StrategyExplanationPanels = ({
  walkthrough,
  about,
}: {
  // null when the draft is not a valid scenario yet.
  walkthrough: ReactNode | null;
  about: ReactNode;
}) => (
  <Stack spacing={3}>
    <DefaultsPanel
      title="Como funciona a simulação"
      items={[]}
      extra={
        walkthrough ?? (
          <span>Preencha um cenário válido para ver a explicação.</span>
        )
      }
    />
    <DefaultsPanel
      title="Sobre a estratégia"
      items={[]}
      extra={
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {about}
        </Text>
      }
    />
  </Stack>
);

export default StrategyExplanationPanels;
