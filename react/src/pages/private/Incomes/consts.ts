export const INCOMES_QUERY_KEY = "incomes";

export const TypesMapping = {
  Rendimento: { value: "INCOME", color: "#cc6cc8" },
  Dividendo: { value: "DIVIDEND", color: "#ccc86c" },
  Reembolso: { value: "REIMBURSEMENT", color: "#7eccb7" },
  "Juros sobre capital próprios": { value: "JCP", color: "#d9d3c5" },
};

export enum EventTypes {
  CREDITED = "CREDITED",
  PROVISIONED = "PROVISIONED",
}
export enum EventTypeLabels {
  CREDITED = "Creditado",
  PROVISIONED = "Provisionado",
}

export const EventTypesMapping = {
  [EventTypeLabels.CREDITED]: EventTypes.CREDITED,
  [EventTypeLabels.PROVISIONED]: EventTypes.PROVISIONED,
  [EventTypes.CREDITED]: EventTypeLabels.CREDITED,
  [EventTypes.PROVISIONED]: EventTypeLabels.PROVISIONED,
};
