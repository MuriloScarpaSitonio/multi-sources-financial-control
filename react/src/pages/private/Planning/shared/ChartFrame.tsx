import { useId, useState, type ReactElement, type ReactNode } from "react";
import CloseIcon from "@mui/icons-material/Close";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { ResponsiveContainer } from "recharts";

import {
  Colors,
  FontSizes,
  FontWeights,
  Text,
} from "../../../../design-system";

type ChartFrameProps = {
  title: ReactNode;
  subtitle: ReactNode;
  headerAction?: ReactNode;
  fullscreenControls?: ReactNode;
  chart: ReactElement;
  height: number;
  expandable?: boolean;
  showHeading?: boolean;
  marginTop?: number;
};

export const ChartFrame = ({
  title,
  subtitle,
  headerAction,
  fullscreenControls,
  chart,
  height,
  expandable = false,
  showHeading = true,
  marginTop = 1,
}: ChartFrameProps) => {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();

  return (
    <>
      <Stack gap={0.5} sx={{ mt: marginTop }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1}
        >
          {showHeading && (
            <Text
              size={FontSizes.SMALL}
              weight={FontWeights.SEMI_BOLD}
              color={Colors.neutral200}
            >
              {title}
            </Text>
          )}
          {(headerAction || expandable) && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.5}
              sx={{ ml: "auto" }}
            >
              {headerAction}
              {expandable && (
                <Tooltip title="Tela cheia">
                  <IconButton
                    aria-label={`Expandir gráfico: ${title}`}
                    size="small"
                    onClick={() => setExpanded(true)}
                  >
                    <FullscreenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
        </Stack>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {subtitle}
        </Text>
      </Stack>
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
      {expandable && (
        <Dialog
          fullScreen
          open={expanded}
          onClose={() => setExpanded(false)}
          aria-labelledby={titleId}
        >
          <DialogTitle
            id={titleId}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Box sx={{ flex: 1 }}>{title}</Box>
            {headerAction}
            <IconButton
              aria-label="Fechar tela cheia"
              onClick={() => setExpanded(false)}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {fullscreenControls}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chart}
              </ResponsiveContainer>
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
