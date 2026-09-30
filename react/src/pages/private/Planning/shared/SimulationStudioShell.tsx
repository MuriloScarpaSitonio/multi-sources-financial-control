import { useState, type ReactNode } from "react";
import Collapse from "@mui/material/Collapse";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { Theme } from "@mui/material/styles";

export const useStudioLayout = () => {
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  return {
    resultsExpanded,
    setResultsExpanded,
    panelCollapsed,
    setPanelCollapsed,
    mobilePanelOpen,
    setMobilePanelOpen,
    openPanel: () => {
      setPanelCollapsed(false);
      setMobilePanelOpen(true);
    },
  };
};

export type StudioLayout = ReturnType<typeof useStudioLayout>;

type Props = {
  layout: StudioLayout;
  testId: string;
  resultsId: string;
  renderHeader?: (recalculate: ReactNode) => ReactNode;
  canRecalculate: boolean;
  onRecalculate: () => void;
  // The panel's collapse control is only offered on desktop.
  renderPanel: (onCollapse?: () => void) => ReactNode;
  hasFallbackHistory: boolean;
  comparisonOpen: boolean;
  comparisonDisabled: boolean;
  onComparisonOpenChange: (open: boolean) => void;
  comparison: ReactNode;
  results: ReactNode;
  explanation: ReactNode;
};

const SimulationStudioShell = ({
  layout,
  testId,
  resultsId,
  renderHeader,
  canRecalculate,
  onRecalculate,
  renderPanel,
  hasFallbackHistory,
  comparisonOpen,
  comparisonDisabled,
  onComparisonOpenChange,
  comparison,
  results,
  explanation,
}: Props) => {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("md"),
  );
  const {
    resultsExpanded,
    setResultsExpanded,
    panelCollapsed,
    setPanelCollapsed,
    mobilePanelOpen,
    setMobilePanelOpen,
  } = layout;
  const panel = renderPanel(
    isMobile ? undefined : () => setPanelCollapsed(true),
  );

  return (
    <>
      {renderHeader?.(
        canRecalculate ? (
          <Button size="small" variant="brand" onClick={onRecalculate}>
            Recalcular
          </Button>
        ) : null,
      )}
      <Box
        data-testid={testId}
        data-panel-collapsed={panelCollapsed}
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: panelCollapsed ? "56px minmax(0, 1fr)" : "360px minmax(0, 1fr)",
          },
          gap: 2,
          alignItems: "start",
        }}
      >
        {isMobile ? (
          <Stack gap={1}>
            <Button
              variant="outlined"
              onClick={() => setMobilePanelOpen((open) => !open)}
            >
              {mobilePanelOpen ? "Ocultar cenário" : "Editar cenário"}
            </Button>
            {mobilePanelOpen && panel}
          </Stack>
        ) : panelCollapsed ? (
          <Paper
            elevation={1}
            sx={{ position: "sticky", top: 80, p: 1, borderRadius: 2 }}
          >
            <IconButton
              aria-label="Expandir cenário"
              onClick={() => setPanelCollapsed(false)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Paper>
        ) : (
          <Stack
            gap={1}
            sx={{
              position: "sticky",
              top: 80,
              maxHeight: "calc(100dvh - 96px)",
              overflowY: "auto",
            }}
          >
            {panel}
          </Stack>
        )}

        <Stack gap={1} sx={{ minWidth: 0 }}>
          <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
            <Stack
              direction="row"
              alignItems="center"
              gap={1}
              flexWrap="wrap"
              sx={{ minHeight: 32 }}
            >
              <Button
                size="small"
                variant="brand-text"
                aria-expanded={resultsExpanded}
                aria-controls={resultsId}
                endIcon={
                  resultsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                sx={{ alignSelf: "flex-start" }}
                onClick={() => setResultsExpanded((value) => !value)}
              >
                {resultsExpanded ? "Recolher simulação" : "Expandir simulação"}
              </Button>
              {hasFallbackHistory && (
                <Chip
                  size="small"
                  variant="brand"
                  label="Histórico complementado"
                />
              )}
              {hasFallbackHistory && (
                <Button
                  variant="brand-text"
                  size="small"
                  disabled={!comparisonOpen && comparisonDisabled}
                  onClick={() => {
                    setResultsExpanded(true);
                    onComparisonOpenChange(!comparisonOpen);
                  }}
                >
                  {comparisonOpen
                    ? "Fechar comparação"
                    : "Comparar sem complemento"}
                </Button>
              )}
            </Stack>
          </Paper>
          <Collapse
            in={resultsExpanded}
            id={resultsId}
            role="region"
            aria-label="Resultados da simulação"
          >
            <Stack gap={1} sx={{ minWidth: 0 }}>
              {comparisonOpen && comparison}
              <Box sx={{ display: comparisonOpen ? "none" : "block" }}>
                {results}
              </Box>
            </Stack>
          </Collapse>
          {explanation}
        </Stack>
      </Box>
    </>
  );
};

export default SimulationStudioShell;
