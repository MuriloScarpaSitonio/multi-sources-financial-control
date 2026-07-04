import { useMemo, useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef as Column,
  type MRT_Row as Row,
} from "material-react-table";

import { Colors, getColor } from "../../../../design-system";
import { AssetCurrencies, AssetCurrencyMap } from "../consts";
import { priceDiffPct } from "./logic";
import type {
  B3ActionEntry,
  B3Income,
  B3ImportResponse,
  B3Operation,
  B3OperationReport,
  B3Transaction,
} from "./types";

const OPERATION_LABELS: Record<B3Operation, string> = {
  negociacoes: "Negociações",
  renda_fixa: "Renda Fixa",
  tesouro: "Tesouro",
  proventos: "Proventos",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Ativo criado",
  asset_created: "Ativo criado",
  transaction_created: "Transação criada",
  income_created: "Provento criado",
  price_updated: "Preço atualizado",
  price_skipped: "Preço mantido",
  skipped: "Ignorado",
  already_exists: "Já cadastrado",
  unsupported_event: "Tipo não suportado",
  error: "Erro",
};

// Rows skipped only because the record already exists in the DB.
const ALREADY_EXISTS = "already_exists";

const TRANSACTION_CREATED = "transaction_created";
const isAssetCreated = (action: string) =>
  action === "asset_created" || action === "created";

const INCOME_TYPE_LABELS: Record<string, string> = {
  DIVIDEND: "Dividendo",
  JCP: "JCP",
  INCOME: "Rendimento",
  REIMBURSEMENT: "Reembolso",
};

// "2026-06-11" -> "11/06/2026"
const formatDateBr = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// "JCP · R$221,58 · 11/06/2026"
const formatIncome = (income: B3Income): string => {
  const typeLabel = INCOME_TYPE_LABELS[income.type] ?? income.type;
  const symbol =
    AssetCurrencyMap[income.currency as AssetCurrencies]?.symbol ?? "";
  const amount = Number(income.amount).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${typeLabel} · ${symbol}${amount} · ${formatDateBr(income.operation_date)}`;
};

const TX_ACTION_LABELS: Record<string, string> = {
  BUY: "Compra",
  SELL: "Venda",
};

// "Compra 100 @ 21.71 em 11/06/2026"
const formatTransaction = (tx: B3Transaction): string => {
  const action = TX_ACTION_LABELS[tx.action] ?? tx.action;
  return `${action} ${tx.quantity} @ ${tx.price} em ${formatDateBr(tx.operation_date)}`;
};

// These chips label an outcome (not a status), so render them as outlined tags
// tinted with design-system tokens: brand for things that happened, neutral for
// no-ops, danger for failures.
const COLOR_BY_ACTION: Record<string, Colors> = {
  created: Colors.brand,
  asset_created: Colors.brand,
  transaction_created: Colors.brand,
  income_created: Colors.brand,
  price_updated: Colors.brand,
  price_skipped: Colors.neutral300,
  skipped: Colors.neutral300,
  already_exists: Colors.neutral300,
  unsupported_event: Colors.neutral300,
  error: Colors.danger200,
};

const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;

const ActionChip = ({ action, label }: { action: string; label: string }) => {
  const color = getColor(COLOR_BY_ACTION[action] ?? Colors.neutral300);
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      sx={{ borderColor: color, color }}
    />
  );
};

const detailText = (entry: B3ActionEntry): string => {
  if (entry.action === "skipped") return entry.reason ?? "";
  if (entry.action === "price_skipped") return entry.reason ?? "";
  if (entry.action === ALREADY_EXISTS) return entry.reason ?? "";
  if (entry.action === "unsupported_event") return entry.reason ?? "";
  if (entry.action === "error") return entry.reason ?? "";
  if (entry.action === "income_created" && entry.income)
    return formatIncome(entry.income);
  return "";
};

const PriceUpdatedDetail = ({ entry }: { entry: B3ActionEntry }) => {
  const pct = priceDiffPct(entry.previous_price, entry.new_price);
  return (
    <>
      {entry.previous_price ?? "—"} → {entry.new_price ?? "—"}
      {pct !== null && (
        <Typography
          component="span"
          variant="body2"
          sx={{
            ml: 1,
            color: getColor(pct >= 0 ? Colors.brand : Colors.danger200),
          }}
        >
          ({pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%)
        </Typography>
      )}
    </>
  );
};

type ReportRow = B3ActionEntry & { subRows?: ReportRow[] };

// Synthetic parent for an asset that has events (transactions/incomes) but no
// asset-level row in this operation (e.g. an existing asset in proventos).
const SYNTHETIC_ASSET = "asset";
// Asset-level rows that can head a group.
const ASSET_LEVEL = new Set([
  "asset_created",
  "created",
  "price_updated",
  "price_skipped",
]);
// Per-event rows that nest under their asset.
const EVENT_LEVEL = new Set([TRANSACTION_CREATED, "income_created", ALREADY_EXISTS]);
const ISSUE_LEVEL = new Set(["skipped", "error"]);

// Aggregate an operation's actions by asset: every same-code row hangs off a
// single asset parent (its transactions, incomes, etc. as nested subRows). When
// the op has no asset-level row for that code, synthesize one. Issues
// (skipped/error) and code-less rows stay standalone.
const buildReportRows = (actions: B3ActionEntry[]): ReportRow[] => {
  const order: string[] = [];
  const byCode = new Map<string, B3ActionEntry[]>();

  for (const a of actions) {
    const code = a.code ?? "";
    if (!byCode.has(code)) {
      byCode.set(code, []);
      order.push(code);
    }
    byCode.get(code)!.push(a);
  }

  const rows: ReportRow[] = [];
  for (const code of order) {
    const group = byCode.get(code)!;
    if (!code) {
      group.forEach((a) => rows.push({ ...a }));
      continue;
    }

    const parents = group.filter((a) => ASSET_LEVEL.has(a.action));
    const issues = group.filter((a) => ISSUE_LEVEL.has(a.action));
    const events: B3ActionEntry[] = [];
    for (const a of group) {
      if (EVENT_LEVEL.has(a.action)) events.push(a);
      // renda_fixa/tesouro bundle their transactions on the "created" entry
      if (isAssetCreated(a.action) && a.transactions?.length) {
        a.transactions.forEach((tx) =>
          events.push({ action: TRANSACTION_CREATED, code, transaction: tx }),
        );
      }
    }

    if (parents.length > 0) {
      const [parent, ...extra] = parents;
      rows.push({ ...parent, subRows: events });
      extra.forEach((p) => rows.push({ ...p }));
    } else if (events.length > 0) {
      rows.push({
        action: SYNTHETIC_ASSET,
        code,
        description: events.find((e) => e.description)?.description,
        asset_pk: events.find((e) => e.asset_pk)?.asset_pk,
        subRows: events,
      });
    }
    issues.forEach((i) => rows.push({ ...i }));
  }

  return rows;
};

const CodeCell = ({ row }: { row: Row<ReportRow> }) => {
  if (row.depth > 0) return null; // nested transactions inherit the asset's code
  const entry = row.original;
  return (
    <Stack spacing={0}>
      <span>{entry.code ?? "—"}</span>
      {entry.description && (
        <Typography variant="caption" color={getColor(Colors.neutral300)}>
          {entry.description}
        </Typography>
      )}
    </Stack>
  );
};

const DetailCell = ({ row }: { row: Row<ReportRow> }) => {
  const entry = row.original;
  if (entry.action === SYNTHETIC_ASSET) return null;
  if (entry.action === TRANSACTION_CREATED && entry.transaction)
    return <>{formatTransaction(entry.transaction)}</>;
  if (entry.action === "price_updated") return <PriceUpdatedDetail entry={entry} />;
  return <>{detailText(entry)}</>;
};

const REPORT_COLUMNS: Column<ReportRow>[] = [
  { id: "code", header: "Ativo", accessorFn: (r) => r.code ?? "", Cell: CodeCell },
  {
    id: "action",
    header: "Ação",
    accessorFn: (r) => r.action,
    size: 160,
    // The synthetic asset parent is just a grouping header, so it has no chip.
    Cell: ({ row }) =>
      row.original.action === SYNTHETIC_ASSET ? null : (
        <ActionChip
          action={row.original.action}
          label={actionLabel(row.original.action)}
        />
      ),
  },
  { id: "detail", header: "Detalhe", accessorFn: () => "", Cell: DetailCell },
];

const summaryChips = (actions: B3ActionEntry[]) => {
  const counts: Record<string, number> = {};
  actions.forEach((a) => {
    counts[a.action] = (counts[a.action] ?? 0) + 1;
  });
  return Object.entries(counts).map(([action, count]) => (
    <ActionChip
      key={action}
      action={action}
      label={`${actionLabel(action)}: ${count}`}
    />
  ));
};

const StatusPill = ({ dryRun }: { dryRun: boolean }) => (
  <Chip
    size="small"
    variant="outlined"
    label={dryRun ? "PRÉ-VISUALIZAÇÃO" : "APLICADO"}
    sx={{
      borderColor: getColor(dryRun ? Colors.neutral300 : Colors.brand),
      color: getColor(dryRun ? Colors.neutral300 : Colors.brand),
    }}
  />
);

// Action types the report can filter out, in display order. "unsupported_event"
// is intentionally absent — those rows are never hidden.
const FILTERABLE_ACTIONS: { action: string; label: string }[] = [
  { action: "skipped", label: "Ignorados" },
  { action: "price_skipped", label: "Preço mantido" },
  { action: ALREADY_EXISTS, label: "Já cadastrados" },
];

const ReportFilterMenu = ({
  present,
  hidden,
  onToggle,
}: {
  present: Set<string>;
  hidden: Set<string>;
  onToggle: (action: string) => void;
}) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const items = FILTERABLE_ACTIONS.filter((f) => present.has(f.action));
  if (items.length === 0) return null;
  const count = items.filter((f) => hidden.has(f.action)).length;
  return (
    <>
      <Button
        size="small"
        startIcon={<FilterListIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: getColor(Colors.neutral300) }}
      >
        {`Filtrar${count ? ` (${count})` : ""}`}
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
      >
        <Stack sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption" color={getColor(Colors.neutral300)}>
            Mostrar
          </Typography>
          {items.map((f) => (
            <FormControlLabel
              key={f.action}
              control={
                <Checkbox
                  size="small"
                  checked={!hidden.has(f.action)}
                  onChange={() => onToggle(f.action)}
                />
              }
              label={f.label}
            />
          ))}
        </Stack>
      </Menu>
    </>
  );
};

// An asset-aggregated table for a list of actions (one operation, or all of them
// merged). Summary chips count everything; the table hides the filtered actions.
const ReportTable = ({
  actions,
  hidden,
}: {
  actions: B3ActionEntry[];
  hidden: Set<string>;
}) => {
  const data = useMemo(
    () => buildReportRows(actions.filter((a) => !hidden.has(a.action))),
    [actions, hidden],
  );

  const table = useMaterialReactTable({
    columns: REPORT_COLUMNS,
    data,
    enableExpanding: true,
    getSubRows: (row) => row.subRows,
    filterFromLeafRows: false,
    enableExpandAll: false,
    enableSorting: false,
    enablePagination: false,
    enableBottomToolbar: false,
    enableTopToolbar: false,
    enableTableHead: false,
    enableColumnActions: false,
    initialState: { expanded: true },
    mrtTheme: { baseBackgroundColor: getColor(Colors.neutral600) },
    muiTablePaperProps: {
      elevation: 0,
      sx: { backgroundImage: "none" },
    },
    muiExpandButtonProps: { size: "small", sx: { p: 0 } },
    displayColumnDefOptions: {
      "mrt-row-expand": {
        header: "",
        size: 16,
        minSize: 8,
        grow: false,
        muiTableBodyCellProps: { sx: { px: 0 } },
        muiTableHeadCellProps: { sx: { px: 0 } },
      },
    },
  });

  if (data.length === 0)
    return (
      <Typography variant="body2" color={getColor(Colors.neutral300)}>
        Nenhuma ação.
      </Typography>
    );
  return <MaterialReactTable table={table} />;
};

const ActionsSummary = ({ actions }: { actions: B3ActionEntry[] }) => (
  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
    {summaryChips(actions)}
    <Chip
      size="small"
      variant="outlined"
      label={`Total: ${actions.length}`}
      sx={{
        borderColor: getColor(Colors.neutral300),
        color: getColor(Colors.neutral300),
      }}
    />
  </Stack>
);

const OperationContent = ({
  report,
  hidden,
}: {
  report: B3OperationReport;
  hidden: Set<string>;
}) => (
  <Stack spacing={1}>
    <ActionsSummary actions={report.actions} />
    <ReportTable actions={report.actions} hidden={hidden} />
  </Stack>
);

const OperationSection = ({
  op,
  report,
  hidden,
}: {
  op: B3Operation;
  report: B3OperationReport;
  hidden: Set<string>;
}) => (
  <Accordion defaultExpanded>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
        <Typography>{OPERATION_LABELS[op]}</Typography>
        <StatusPill dryRun={report.dry_run} />
      </Stack>
    </AccordionSummary>
    <AccordionDetails>
      <OperationContent report={report} hidden={hidden} />
    </AccordionDetails>
  </Accordion>
);

const B3ImportReport = ({ response }: { response: B3ImportResponse }) => {
  const [aggregateAll, setAggregateAll] = useState(false);
  // Já cadastrados are hidden by default; the other categories start visible.
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set([ALREADY_EXISTS]),
  );
  const toggleHidden = (action: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });

  const ops = (Object.keys(response.reports) as B3Operation[]).filter(
    (op) => response.reports[op],
  );
  const allActions = ops.flatMap((op) => response.reports[op]!.actions);
  const present = new Set(allActions.map((a) => a.action));

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControlLabel
          control={
            <Switch
              checked={aggregateAll}
              onChange={(e) => setAggregateAll(e.target.checked)}
            />
          }
          label="Agregar por ativo"
        />
        <ReportFilterMenu
          present={present}
          hidden={hidden}
          onToggle={toggleHidden}
        />
      </Stack>
      {aggregateAll ? (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>Todos os ativos</Typography>
            <StatusPill dryRun={response.dry_run} />
          </Stack>
          <ActionsSummary actions={allActions} />
          <ReportTable actions={allActions} hidden={hidden} />
        </Stack>
      ) : (
        ops.map((op) => (
          <OperationSection
            key={op}
            op={op}
            report={response.reports[op]!}
            hidden={hidden}
          />
        ))
      )}
    </Stack>
  );
};

export default B3ImportReport;
