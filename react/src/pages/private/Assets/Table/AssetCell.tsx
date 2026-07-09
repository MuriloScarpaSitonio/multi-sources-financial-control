import type { ReactNode } from "react";

import Stack from "@mui/material/Stack";

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
      <span style={{ marginLeft: startAdornment ? "20px" : 0 }}>
        {description}
      </span>
    )}
  </Stack>
);

export default AssetCell;
