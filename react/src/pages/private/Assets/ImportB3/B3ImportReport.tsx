import { Fragment, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { Colors, getColor } from "../../../../design-system";
import { priceDiffPct } from "./logic";
import type {
  B3ActionEntry,
  B3ImportResponse,
  B3Operation,
  B3OperationReport,
} from "./types";

const OPERATION_LABELS: Record<B3Operation, string> = {
  negociacoes: "Negociações",
  renda_fixa: "Renda Fixa",
  tesouro: "Tesouro",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Ativo criado",
  asset_created: "Ativo criado",
  transaction_created: "Transação criada",
  price_updated: "Preço atualizado",
  price_skipped: "Preço mantido",
  skipped: "Ignorado",
  error: "Erro",
};

// These chips label an outcome (not a status), so render them as outlined tags
// tinted with design-system tokens: brand for things that happened, neutral for
// no-ops, danger for failures.
const COLOR_BY_ACTION: Record<string, Colors> = {
  created: Colors.brand,
  asset_created: Colors.brand,
  transaction_created: Colors.brand,
  price_updated: Colors.brand,
  price_skipped: Colors.neutral300,
  skipped: Colors.neutral300,
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
  if (entry.action === "error") return entry.reason ?? "";
  if (entry.action === "created" || entry.action === "asset_created")
    return `#${entry.asset_pk ?? "—"}`;
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

const ActionRow = ({ entry }: { entry: B3ActionEntry }) => {
  const [open, setOpen] = useState(false);
  const subTransactions =
    entry.transactions ?? (entry.transaction ? [entry.transaction] : []);
  const expandable = subTransactions.length > 0;

  return (
    <Fragment>
      <TableRow>
        <TableCell padding="checkbox">
          {expandable && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Stack spacing={0}>
            <span>{entry.code ?? "—"}</span>
            {entry.description && (
              <Typography variant="caption" color={getColor(Colors.neutral300)}>
                {entry.description}
              </Typography>
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <ActionChip action={entry.action} label={actionLabel(entry.action)} />
        </TableCell>
        <TableCell>
          {entry.action === "price_updated" ? (
            <PriceUpdatedDetail entry={entry} />
          ) : (
            detailText(entry)
          )}
        </TableCell>
      </TableRow>
      {open &&
        subTransactions.map((tx, i) => (
          <TableRow key={i}>
            <TableCell />
            <TableCell colSpan={3}>
              <Typography variant="body2" color={getColor(Colors.neutral300)}>
                {tx.action} {tx.quantity} @ {tx.price} em {tx.operation_date}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
    </Fragment>
  );
};

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

const OperationContent = ({ report }: { report: B3OperationReport }) => (
  <Stack spacing={1}>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {summaryChips(report.actions)}
      <Chip
        size="small"
        variant="outlined"
        label={`Total: ${report.actions.length}`}
        sx={{
          borderColor: getColor(Colors.neutral300),
          color: getColor(Colors.neutral300),
        }}
      />
    </Stack>
    {report.actions.length > 0 ? (
      <Table size="small">
        <TableBody>
          {report.actions.map((entry, i) => (
            <ActionRow key={i} entry={entry} />
          ))}
        </TableBody>
      </Table>
    ) : (
      <Typography variant="body2" color={getColor(Colors.neutral300)}>
        Nenhuma ação.
      </Typography>
    )}
  </Stack>
);

const OperationSection = ({
  op,
  report,
  onExpand,
}: {
  op: B3Operation;
  report: B3OperationReport;
  onExpand: () => void;
}) => (
  <Accordion defaultExpanded>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
        <Typography>{OPERATION_LABELS[op]}</Typography>
        <StatusPill dryRun={report.dry_run} />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          component="div"
          role="button"
          size="small"
          aria-label="Expandir"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <OpenInFullIcon fontSize="small" />
        </IconButton>
      </Stack>
    </AccordionSummary>
    <AccordionDetails>
      <OperationContent report={report} />
    </AccordionDetails>
  </Accordion>
);

const B3ImportReport = ({ response }: { response: B3ImportResponse }) => {
  const [expandedOp, setExpandedOp] = useState<B3Operation | null>(null);
  const ops = (Object.keys(response.reports) as B3Operation[]).filter(
    (op) => response.reports[op],
  );
  const expandedReport = expandedOp ? response.reports[expandedOp] : null;

  return (
    <>
      <Stack spacing={1}>
        {ops.map((op) => (
          <OperationSection
            key={op}
            op={op}
            report={response.reports[op]!}
            onExpand={() => setExpandedOp(op)}
          />
        ))}
      </Stack>
      <Drawer
        open={expandedOp !== null}
        onClose={() => setExpandedOp(null)}
        anchor="right"
        slotProps={{
          paper: {
            sx: {
              width: "90vw",
              maxWidth: 1200,
              backgroundColor: getColor(Colors.neutral600),
              backgroundImage: "none",
            },
          },
        }}
      >
        {expandedOp && expandedReport && (
          <Stack spacing={2} sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">{OPERATION_LABELS[expandedOp]}</Typography>
              <StatusPill dryRun={expandedReport.dry_run} />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                size="small"
                aria-label="Fechar"
                onClick={() => setExpandedOp(null)}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
            <OperationContent report={expandedReport} />
          </Stack>
        )}
      </Drawer>
    </>
  );
};

export default B3ImportReport;
