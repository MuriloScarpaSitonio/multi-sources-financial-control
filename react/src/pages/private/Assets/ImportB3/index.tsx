import { useEffect, useMemo, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { ptBR } from "date-fns/locale/pt-BR";

import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import { Colors, getColor } from "../../../../design-system";
import { importB3 } from "../api";
import B3ImportReport from "./B3ImportReport";
import FileDropArea from "./FileDropArea";
import {
  classifyB3File,
  computeSignature,
  isCreateMissingEnabled,
  isOperationEnabled,
  parseWorkbookDtFromFilename,
  type B3FileSlot,
  type B3Files,
} from "./logic";
import type { B3ImportResponse, B3Operation } from "./types";

const OPERATIONS: { op: B3Operation; label: string }[] = [
  { op: "negociacoes", label: "Negociações" },
  { op: "renda_fixa", label: "Renda Fixa" },
  { op: "tesouro", label: "Tesouro" },
];

const SLOT_LABELS: { slot: B3FileSlot; label: string }[] = [
  { slot: "negociacao", label: "Negociação" },
  { slot: "posicao", label: "Posição" },
  { slot: "movimentacao", label: "Movimentação" },
];

const EMPTY_FILES: B3Files = {
  negociacao: null,
  posicao: null,
  movimentacao: null,
};

const B3ImportDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [files, setFiles] = useState<B3Files>(EMPTY_FILES);
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [selectedOps, setSelectedOps] = useState<B3Operation[]>([]);
  const [workbookDt, setWorkbookDt] = useState<Date | null>(null);
  const [createMissingAssets, setCreateMissingAssets] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [report, setReport] = useState<B3ImportResponse | null>(null);
  const [previewedSignature, setPreviewedSignature] = useState<string | null>(
    null,
  );

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

  const currentSignature = useMemo(
    () => computeSignature(files, selectedOps, workbookDt, createMissingAssets),
    [files, selectedOps, workbookDt, createMissingAssets],
  );

  const needsWorkbookDt = selectedOps.some(
    (op) => op === "renda_fixa" || op === "tesouro",
  );

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

  // Wipe everything once the drawer has finished sliding out (avoids a flash of
  // cleared fields during the close animation).
  const resetState = () => {
    setFiles(EMPTY_FILES);
    setUnrecognized([]);
    setSelectedOps([]);
    setWorkbookDt(null);
    setCreateMissingAssets(false);
    setDryRun(true);
    setReport(null);
    setPreviewedSignature(null);
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
      selectedOps.forEach((op) => fd.append("operations", op));
      fd.append("dry_run", String(asDryRun));
      fd.append("create_missing_assets", String(createMissingAssets));
      if (workbookDt) fd.append("workbook_dt", workbookDt.toISOString());
      return importB3(fd);
    },
    onSuccess: (data, asDryRun) => {
      setReport(data);
      if (asDryRun) {
        setPreviewedSignature(currentSignature);
        enqueueSnackbar("Pré-visualização gerada", { variant: "success" });
      } else {
        setPreviewedSignature(null);
        enqueueSnackbar("Importação aplicada", { variant: "success" });
      }
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

  const canPreview =
    selectedOps.length > 0 && (!needsWorkbookDt || workbookDt !== null);
  const canApply = !dryRun && canPreview && previewedSignature === currentSignature;
  const submitDisabled = isPending || (dryRun ? !canPreview : !canApply);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      slotProps={{
        transition: { onExited: resetState },
        paper: {
          sx: {
            width: 650,
            maxWidth: "100vw",
            backgroundColor: getColor(Colors.neutral600),
            boxShadow: "none",
            backgroundImage: "none",
          },
        },
      }}
    >
      <Stack spacing={3} sx={{ p: 3 }}>
        <Typography variant="h6">Importar arquivos da B3</Typography>

        <Stack spacing={1.5}>
          <FileDropArea onFiles={handleFiles} />
          {SLOT_LABELS.map(({ slot, label }) => {
            const file = files[slot];
            return file ? (
              <Stack key={slot} direction="row" spacing={1} alignItems="center">
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

        <Divider />

        <Stack
          spacing={2}
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="subtitle2">Importações</Typography>
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
              slotProps={{ textField: { variant: "standard", required: true } }}
            />
          </LocalizationProvider>
        )}

        <Stack
          direction="row"
          spacing={4}
          alignItems="flex-start"
          flexWrap="wrap"
          useFlexGap
        >
          <FormControlLabel
            control={
              <Switch
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
            }
            label="Dry run (pré-visualizar)"
          />
          {selectedOps.includes("negociacoes") && (
            <Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={createMissingAssets}
                    disabled={files.posicao === null}
                    onChange={(e) => setCreateMissingAssets(e.target.checked)}
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

        {!dryRun && previewedSignature !== currentSignature && (
          <Typography variant="caption" color="warning.main">
            Pré-visualize a configuração atual antes de aplicar.
          </Typography>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="brand-text" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="brand"
            disabled={submitDisabled}
            onClick={() => mutate(dryRun)}
          >
            {isPending ? (
              <CircularProgress color="inherit" size={24} />
            ) : dryRun ? (
              "Pré-visualizar"
            ) : (
              "Aplicar"
            )}
          </Button>
        </Stack>

        {report && <B3ImportReport response={report} />}
      </Stack>
    </Drawer>
  );
};

export default B3ImportDrawer;
