import type { WithdrawalMethodKey } from "./api";
import type { ProConItem } from "./strategyContent";

export const GALENO_RATIONALE =
  "Usando esse método alternativo, 7½ anos de retiradas são mantidos em renda fixa, " +
  "o resto do portfólio em renda variável. A cada ano, uma porcentagem da alocação em renda variável " +
  "é vendida e movida para a alocação em renda fixa. O novo valor de retirada anual é calculado " +
  "dividindo o total em renda fixa por 7½. Conforme as ações sobem, a alocação em renda fixa será " +
  "gradualmente aumentada e permitirá retiradas anuais maiores. Por outro lado, conforme as ações caem, " +
  "a alocação em renda fixa será gradualmente diminuída e lentamente resultará em retiradas anuais menores. " +
  "No entanto, como há um buffer de 7½ anos de retiradas em renda fixa, os valores de retirada de ano " +
  "para ano são suavizados e não flutuam muito.";

export const GALENO_PROS: ProConItem[] = [
  { text: "Protege contra quedas do mercado — você não precisa vender ações em baixa", galeno: true },
  { text: "Permite que ações continuem crescendo sem necessidade de venda forçada", galeno: true },
  { text: "Dá previsibilidade de renda no curto/médio prazo via renda fixa", galeno: true },
];

export const GALENO_CONS: ProConItem[] = [
  { text: "Reduz exposição a ações, limitando potencial de crescimento", galeno: true },
  { text: "Transferências anuais exigem disciplina e rebalanceamento", galeno: true },
  { text: "Colchão pode ser insuficiente se a queda do mercado durar mais que o previsto", galeno: true },
];

export const AGE_IN_BONDS_TITLES: Partial<Record<WithdrawalMethodKey, { title: string; subtitle: string }>> = {
  fire: {
    title: "Retirada constante - FIRE (Idade em Renda Fixa)",
    subtitle: "Retire suas despesas atuais ajustadas pela inflação, com alocação em renda fixa acompanhando sua idade.",
  },
};

// Idade em RF rationale and pros/cons live inside AgeInBondsExplainer now —
// the copy is dynamic (references the user's age and current bond%) and
// renders as a single dedicated panel rather than being spliced into the
// strategy's global rationale and pros/cons lists.
