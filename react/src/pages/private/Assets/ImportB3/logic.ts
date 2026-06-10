import type { B3Operation } from "./types";

export type B3Files = {
  negociacao: File | null;
  posicao: File | null;
  movimentacao: File | null;
};

export type B3FileSlot = keyof B3Files;

// B3 exports keep their original names (negociacao-*.xlsx, posicao-*.xlsx,
// movimentacao-*.xlsx), so a single drop can be routed to the right slot.
export const classifyB3File = (name: string): B3FileSlot | null => {
  const lower = name.toLowerCase();
  if (lower.startsWith("negociacao")) return "negociacao";
  if (lower.startsWith("posicao")) return "posicao";
  if (lower.startsWith("movimentacao")) return "movimentacao";
  return null;
};

export const isOperationEnabled = (op: B3Operation, files: B3Files): boolean => {
  if (op === "negociacoes") return files.negociacao !== null;
  // renda_fixa and tesouro both require posicao AND movimentacao
  return files.posicao !== null && files.movimentacao !== null;
};

// "Criar ativos ausentes" only matters for Negociações, and creating an asset
// needs the Posição file as its source.
export const isCreateMissingEnabled = (
  files: B3Files,
  operations: B3Operation[],
): boolean => operations.includes("negociacoes") && files.posicao !== null;

const FILENAME_RE = /posicao-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.xlsx$/i;

export const parseWorkbookDtFromFilename = (name: string): Date | null => {
  const match = FILENAME_RE.exec(name);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
};

// Percent change previous -> new; null when there's no usable baseline.
export const priceDiffPct = (
  previous: string | null | undefined,
  next: string | null | undefined,
): number | null => {
  const prev = Number(previous);
  const cur = Number(next);
  if (!previous || !Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) {
    return null;
  }
  return ((cur - prev) / prev) * 100;
};

const fileKey = (file: File | null): string =>
  file ? `${file.name}:${file.size}` : "-";

export const computeSignature = (
  files: B3Files,
  operations: B3Operation[],
  workbookDt: Date | null,
  createMissingAssets: boolean,
): string =>
  JSON.stringify({
    neg: fileKey(files.negociacao),
    pos: fileKey(files.posicao),
    mov: fileKey(files.movimentacao),
    ops: [...operations].sort(),
    dt: workbookDt ? workbookDt.toISOString() : "-",
    cma: createMissingAssets,
  });
