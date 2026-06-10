import {
  classifyB3File,
  computeSignature,
  isCreateMissingEnabled,
  isOperationEnabled,
  parseWorkbookDtFromFilename,
  priceDiffPct,
  type B3Files,
} from "./logic";

const assertEqual = <T>(actual: T, expected: T, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

// A pure-logic stand-in for File (avoids depending on a global File impl).
const fakeFile = (name: string): File =>
  ({ name, size: name.length }) as unknown as File;

const files = (neg = false, pos = false, mov = false): B3Files => ({
  negociacao: neg ? fakeFile("negociacao.xlsx") : null,
  posicao: pos ? fakeFile("posicao-2026-04-29-12-00-00.xlsx") : null,
  movimentacao: mov ? fakeFile("movimentacao.xlsx") : null,
});

// negociacoes needs the negociacao file
assertEqual(isOperationEnabled("negociacoes", files(true)), true, "neg enabled");
assertEqual(isOperationEnabled("negociacoes", files(false)), false, "neg disabled");

// renda_fixa / tesouro need BOTH posicao and movimentacao
assertEqual(isOperationEnabled("renda_fixa", files(false, true, true)), true, "rf enabled");
assertEqual(isOperationEnabled("renda_fixa", files(false, true, false)), false, "rf needs mov");
assertEqual(isOperationEnabled("tesouro", files(false, false, true)), false, "tesouro needs pos");

// price diff percentage
assertEqual(priceDiffPct("100", "110"), 10, "diff +10%");
assertEqual(priceDiffPct("100", "90"), -10, "diff -10%");
assertEqual(priceDiffPct(null, "90"), null, "no baseline -> null");
assertEqual(priceDiffPct("0", "90"), null, "zero baseline -> null");

// file classification by B3 filename convention
assertEqual(classifyB3File("negociacao-2026.xlsx"), "negociacao", "negociacao classified");
assertEqual(
  classifyB3File("posicao-2026-04-29-12-00-00.xlsx"),
  "posicao",
  "posicao classified",
);
assertEqual(classifyB3File("movimentacao-2026.xlsx"), "movimentacao", "movimentacao classified");
assertEqual(classifyB3File("relatorio.xlsx"), null, "unknown -> null");

// filename parsing
const parsed = parseWorkbookDtFromFilename("posicao-2026-04-29-12-00-00.xlsx");
assertEqual(parsed?.getFullYear(), 2026, "year parsed");
assertEqual(parsed?.getMonth(), 3, "month parsed (0-based April)");
assertEqual(parsed?.getDate(), 29, "day parsed");
assertEqual(parseWorkbookDtFromFilename("renamed.xlsx"), null, "bad name -> null");

// create-missing gate: needs negociacoes selected AND posicao present
assertEqual(
  isCreateMissingEnabled(files(true, true), ["negociacoes"]),
  true,
  "create-missing enabled with neg+posicao",
);
assertEqual(
  isCreateMissingEnabled(files(true, false), ["negociacoes"]),
  false,
  "create-missing needs posicao",
);
assertEqual(
  isCreateMissingEnabled(files(true, true), ["renda_fixa"]),
  false,
  "create-missing needs negociacoes selected",
);

// signature changes when inputs change
const base = files(false, true, true);
const dt = new Date("2026-04-29T12:00:00");
assertEqual(
  computeSignature(base, ["renda_fixa"], dt, false) ===
    computeSignature(base, ["renda_fixa"], dt, false),
  true,
  "stable signature for same inputs",
);
assertEqual(
  computeSignature(base, ["renda_fixa"], dt, false) ===
    computeSignature(base, ["renda_fixa", "tesouro"], dt, false),
  false,
  "ops change -> signature changes",
);
assertEqual(
  computeSignature(base, ["renda_fixa"], dt, false) ===
    computeSignature(base, ["renda_fixa"], dt, true),
  false,
  "create-missing toggle -> signature changes",
);

// eslint-disable-next-line no-console
console.log("logic.test.ts passed");
