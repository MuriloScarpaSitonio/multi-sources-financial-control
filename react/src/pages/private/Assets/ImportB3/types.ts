export type B3Operation =
  | "negociacoes"
  | "renda_fixa"
  | "tesouro"
  | "proventos";

export type B3Transaction = {
  action: string;
  price: string;
  quantity: string;
  operation_date: string;
};

export type B3Income = {
  type: string;
  amount: string;
  currency: string;
  operation_date: string;
};

export type B3ActionEntry = {
  code?: string | null;
  action: string;
  reason?: string;
  description?: string;
  asset_pk?: number;
  type?: string;
  new_price?: string;
  previous_price?: string | null;
  transactions?: B3Transaction[];
  transaction?: B3Transaction;
  income?: B3Income;
};

export type B3OperationReport = {
  dry_run: boolean;
  actions: B3ActionEntry[];
  workbook_dt?: string;
  posicao_path?: string | null;
  negociacao_path?: string | null;
  proventos_path?: string | null;
};

export type B3ImportResponse = {
  dry_run: boolean;
  reports: Partial<Record<B3Operation, B3OperationReport>>;
};
