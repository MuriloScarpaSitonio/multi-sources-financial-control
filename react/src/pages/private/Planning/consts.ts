import type { WithdrawalMethodKey } from "./api";
import type { ProConItem } from "./MethodCard";

export type MethodConfig = {
  key: WithdrawalMethodKey;
  title: string;
  subtitle: string;
  rationale: string;
  pros: ProConItem[];
  cons: ProConItem[];
};

export const GALENO_RATIONALE =
  "Complementado pelo método Galeno: a cada ano, uma porcentagem das ações é transferida " +
  "para renda fixa, formando um colchão de segurança. As retiradas vêm da renda fixa, " +
  "permitindo que as ações continuem crescendo. Assim, você evita vender ações " +
  "em momentos de queda do mercado.";

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

export const METHODS: MethodConfig[] = [
  {
    key: "fire",
    title: "Regra dos X%",
    subtitle: "Acumule um múltiplo das suas despesas anuais e viva dos rendimentos.",
    rationale:
      "Baseado no Trinity Study, a regra dos 4% (25x) sugere que um portfólio " +
      "diversificado pode sustentar retiradas anuais de 4% por pelo menos 30 anos " +
      "com alta probabilidade de sucesso. Multiplicadores maiores (28–35x) oferecem " +
      "margem de segurança extra para horizontes mais longos ou mercados voláteis.",
    pros: [
      { text: "Simples de calcular e acompanhar" },
      { text: "Amplamente estudado e validado historicamente (Trinity Study)" },
      { text: "Funciona bem para horizontes de 30+ anos com portfólio diversificado" },
    ],
    cons: [
      { text: "Não considera variações de mercado após a aposentadoria" },
      { text: "A renda mensal varia conforme o desempenho do portfólio" },
      { text: "Pode exigir ajustes se as despesas mudarem significativamente" },
    ],
  },
  {
    key: "dividends_only",
    title: "Viver de proventos",
    subtitle: "Cubra suas despesas apenas com dividendos e proventos recebidos.",
    rationale:
      "Essa estratégia preserva o patrimônio integralmente, pois você nunca vende " +
      "ativos — vive apenas da renda passiva gerada (dividendos, JCP, aluguéis de FIIs). " +
      "É considerada mais conservadora, mas exige um patrimônio maior ou despesas menores " +
      "para atingir 100% de cobertura.",
    pros: [
      { text: "Patrimônio é preservado integralmente — nunca se vende ativos" },
      { text: "Renda gerada sem reduzir o número de ativos na carteira" },
    ],
    cons: [
      { text: "Exige patrimônio significativamente maior para cobrir 100% das despesas" },
      { text: "Dividendos podem ser cortados em crises" },
      { text: "Concentração em ativos pagadores de dividendos pode reduzir diversificação" },
    ],
  },
  {
    key: "constant_withdrawal",
    title: "Retirada constante",
    subtitle:
      "Mantenha seu padrão de vida atual retirando suas despesas mensais, ajustadas pela inflação.",
    rationale:
      "Você retira o equivalente às suas despesas atuais, corrigido pela inflação a cada ano. " +
      "O indicador simula quantos anos o portfólio sustenta essa retirada dado um retorno real esperado. " +
      "Oferece previsibilidade de renda, mas o portfólio pode se esgotar se os retornos reais " +
      "forem menores que o esperado por períodos prolongados.",
    pros: [
      { text: "Renda mensal previsível e estável" },
      { text: "Fácil de planejar o orçamento — você sabe exatamente quanto vai retirar" },
      { text: "Permite simular diferentes cenários de retorno real" },
    ],
    cons: [
      { text: "Portfólio pode se esgotar se retornos reais forem abaixo do esperado" },
      { text: "Não se adapta a quedas de mercado — retirada fixa mesmo em anos ruins" },
      { text: "Exige monitoramento da sustentabilidade ao longo do tempo" },
    ],
  },
];
