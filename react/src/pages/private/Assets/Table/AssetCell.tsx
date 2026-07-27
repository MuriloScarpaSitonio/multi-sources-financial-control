import type { ReactNode } from "react";

import Stack from "@mui/material/Stack";

import { Colors, FontSizes, Text } from "../../../../design-system";

const AssetCell = ({
  code,
  description,
  startAdornment,
  endAdornment,
}: {
  code: string;
  description?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}) => (
  <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      {startAdornment}
      <span>{code}</span>
      {endAdornment}
    </Stack>
    {!!description && (
      <Text
        size={FontSizes.EXTRA_SMALL}
        color={Colors.neutral300}
        extraStyle={{ marginLeft: startAdornment ? "20px" : 0 }}
      >
        {description}
      </Text>
    )}
  </Stack>
);

export default AssetCell;
