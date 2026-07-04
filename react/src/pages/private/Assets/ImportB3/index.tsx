import { useEffect, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { ptBR } from "date-fns/locale/pt-BR";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import { Colors, getColor } from "../../../../design-system";
import { TRANSACTIONS_QUERY_KEY } from "../../Transactions/consts";
import { importB3 } from "../api";
import { useInvalidateAssetsIndicatorsQueries } from "../Indicators/hooks";
import { useInvalidateAssetsReportsQueries } from "../Reports/hooks";
import { GroupBy } from "../Reports/types";
import { ASSETS_QUERY_KEY } from "../Table/consts";
import B3ImportReport from "./B3ImportReport";
import FileDropArea from "./FileDropArea";
import {
  classifyB3File,
  isCreateMissingEnabled,
  isOperationEnabled,
  parseWorkbookDtFromFilename,
  type B3FileSlot,
  type B3Files,
} from "./logic";
import type { B3ImportResponse, B3Operation } from "./types";

const STEPS = ["Configurar", "Resultado"];

const OPERATIONS: { op: B3Operation; label: string }[] = [
  { op: "negociacoes", label: "Negociações" },
  { op: "renda_fixa", label: "Renda Fixa" },
  { op: "tesouro", label: "Tesouro" },
  { op: "proventos", label: "Proventos" },
];

const SLOT_LABELS: { slot: B3FileSlot; label: string }[] = [
  { slot: "negociacao", label: "Negociação" },
  { slot: "posicao", label: "Posição" },
  { slot: "movimentacao", label: "Movimentação" },
  { slot: "proventos", label: "Proventos" },
];

const EMPTY_FILES: B3Files = {
  negociacao: null,
  posicao: null,
  movimentacao: null,
  proventos: null,
};

const B3ImportDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState<B3Files>(EMPTY_FILES);
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [selectedOps, setSelectedOps] = useState<B3Operation[]>([]);
  const [workbookDt, setWorkbookDt] = useState<Date | null>(null);
  const [createMissingAssets, setCreateMissingAssets] = useState(true);
  const [report, setReport] = useState<B3ImportResponse | null>(null);

  const queryClient = useQueryClient();
  const { invalidate: invalidateAssetsReportsQueries } =
    useInvalidateAssetsReportsQueries();
  const { invalidate: invalidateAssetsIndicatorsQueries } =
    useInvalidateAssetsIndicatorsQueries();

  // When the file set changes, default to every operation those files enable
  // (assume the user wants them all); they can still uncheck before running.
  useEffect(() => {
    setSelectedOps(
      OPERATIONS.map(({ op }) => op).filter((op) => isOperationEnabled(op, files)),
    );
  }, [files]);

  const createMissingEnabled = isCreateMissingEnabled(files, selectedOps);

  // Uncheck "criar ativos ausentes" when it can no longer take effect.
  useEffect(() => {
    if (!createMissingEnabled) setCreateMissingAssets(false);
  }, [createMissingEnabled]);

  const needsWorkbookDt = selectedOps.some(
    (op) => op === "renda_fixa" || op === "tesouro",
  );
  const hasAnyFile = Object.values(files).some(Boolean);

  // Route a batch of dropped/selected files to their slots by filename.
  const handleFiles = (fileList: FileList) => {
    const next: B3Files = { ...files };
    const unknown: string[] = [];
    let posicaoFile: File | null = null;
    Array.from(fileList).forEach((file) => {
      const slot = classifyB3File(file.name);
      if (slot) {
        next[slot] = file;
        if (slot === "posicao") posicaoFile = file;
      } else {
        unknown.push(file.name);
      }
    });
    setFiles(next);
    setUnrecognized(unknown);
    if (posicaoFile) {
      const parsed = parseWorkbookDtFromFilename((posicaoFile as File).name);
      if (parsed) setWorkbookDt(parsed);
    }
  };

  const clearSlot = (slot: B3FileSlot) =>
    setFiles((prev) => ({ ...prev, [slot]: null }));

  // Wipe everything once the dialog has finished closing (avoids a flash of
  // cleared fields during the close animation).
  const resetState = () => {
    setActiveStep(0);
    setFiles(EMPTY_FILES);
    setUnrecognized([]);
    setSelectedOps([]);
    setWorkbookDt(null);
    setCreateMissingAssets(false);
    setReport(null);
  };

  const toggleOp = (op: B3Operation) =>
    setSelectedOps((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );

  const { mutate, isPending } = useMutation({
    mutationFn: (asDryRun: boolean) => {
      const fd = new FormData();
      if (files.negociacao) fd.append("negociacao", files.negociacao);
      if (files.posicao) fd.append("posicao", files.posicao);
      if (files.movimentacao) fd.append("movimentacao", files.movimentacao);
      if (files.proventos) fd.append("proventos", files.proventos);
      selectedOps.forEach((op) => fd.append("operations", op));
      fd.append("dry_run", String(asDryRun));
      fd.append("create_missing_assets", String(createMissingAssets));
      if (workbookDt) fd.append("workbook_dt", workbookDt.toISOString());
      return importB3(fd);
    },
    onSuccess: async (data, asDryRun) => {
      setReport(data);
      setActiveStep(1);
      if (asDryRun) {
        enqueueSnackbar("Pré-visualização gerada", { variant: "success" });
        return;
      }
      await Promise.all([
        invalidateAssetsReportsQueries({ group_by: GroupBy.TYPE }),
        invalidateAssetsIndicatorsQueries(),
        queryClient.invalidateQueries({ queryKey: [ASSETS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] }),
      ]);
      enqueueSnackbar("Importação aplicada", { variant: "success" });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      const data = error?.response?.data;
      const message =
        data?.operation && data?.detail
          ? `${data.operation}: ${data.detail}`
          : "Erro ao importar arquivos da B3";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const canLeaveFiles = hasAnyFile;
  const canRun =
    selectedOps.length > 0 && (!needsWorkbookDt || workbookDt !== null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen
      slotProps={{
        transition: { onExited: resetState },
        paper: {
          sx: {
            backgroundColor: getColor(Colors.neutral600),
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}
      >
        Importar arquivos da B3
        <IconButton
          size="small"
          aria-label="Fechar"
          onClick={onClose}
          sx={{ ml: "auto" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Stack spacing={3}>
            <Stack spacing={1.5}>
              <FileDropArea onFiles={handleFiles} />
              {SLOT_LABELS.map(({ slot, label }) => {
                const file = files[slot];
                return file ? (
                  <Stack
                    key={slot}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Typography variant="caption" sx={{ minWidth: 96 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                      {file.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => clearSlot(slot)}
                      aria-label={`Remover ${label}`}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : null;
              })}
              {unrecognized.length > 0 && (
                <Typography variant="caption" color={getColor(Colors.danger200)}>
                  Não reconhecido: {unrecognized.join(", ")}. Esperado
                  negociacao-*.xlsx, posicao-*.xlsx, movimentacao-*.xlsx
                </Typography>
              )}
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">
                O que você deseja importar?
              </Typography>
              <Stack
                spacing={2}
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                {OPERATIONS.map(({ op, label }) => {
                  const enabled = isOperationEnabled(op, files);
                  return (
                    <FormControlLabel
                      key={op}
                      control={
                        <Checkbox
                          checked={selectedOps.includes(op)}
                          disabled={!enabled}
                          onChange={() => toggleOp(op)}
                        />
                      }
                      label={label}
                    />
                  );
                })}
              </Stack>
            </Stack>

            {(needsWorkbookDt || selectedOps.includes("negociacoes")) && (
              <Stack
                direction="row"
                spacing={4}
                alignItems="flex-start"
                flexWrap="wrap"
                useFlexGap
              >
                {needsWorkbookDt && (
                  <LocalizationProvider
                    dateAdapter={AdapterDateFns}
                    adapterLocale={ptBR}
                  >
                    <DateTimePicker
                      label="Data da posição"
                      value={workbookDt}
                      onChange={(value) => setWorkbookDt(value)}
                      format="dd/MM/yyyy HH:mm:ss"
                      slotProps={{
                        textField: {
                          variant: "standard",
                          required: true,
                          helperText:
                            "Momento da posição (do nome do arquivo). Usada para decidir se o preço atual de Renda Fixa/Tesouro deve ser atualizado.",
                        },
                      }}
                    />
                  </LocalizationProvider>
                )}
                {selectedOps.includes("negociacoes") && (
                  <Stack>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={createMissingAssets}
                          disabled={files.posicao === null}
                          onChange={(e) =>
                            setCreateMissingAssets(e.target.checked)
                          }
                        />
                      }
                      label="Criar ativos ausentes"
                    />
                    {files.posicao === null && (
                      <Typography variant="caption" color="text.secondary">
                        Envie o arquivo de posição para habilitar
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        )}

        {activeStep === 1 && report && <B3ImportReport response={report} />}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep === 0 && (
          <>
            <Button variant="brand-text" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              disabled={isPending || !canLeaveFiles || !canRun}
              onClick={() => mutate(true)}
            >
              {isPending ? (
                <CircularProgress color="inherit" size={24} />
              ) : (
                "Pré-visualizar"
              )}
            </Button>
          </>
        )}
        {activeStep === 1 &&
          (report?.dry_run ? (
            // Showing a preview: let the user go back and tweak, or commit it.
            <>
              <Button variant="brand-text" onClick={() => setActiveStep(0)}>
                Voltar
              </Button>
              <Button
                variant="brand"
                disabled={isPending}
                onClick={() => mutate(false)}
              >
                {isPending ? (
                  <CircularProgress color="inherit" size={24} />
                ) : (
                  "Aplicar"
                )}
              </Button>
            </>
          ) : (
            // Already applied.
            <Button variant="brand" onClick={onClose}>
              Fechar
            </Button>
          ))}
      </DialogActions>
    </Dialog>
  );
};

export default B3ImportDrawer;
