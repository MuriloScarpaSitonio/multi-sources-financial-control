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
  {
    key: "one_over_n",
    title: "Retirada 1/N (Esgotamento planejado)",
    subtitle:
      "Divida o patrimônio pelo número de anos restantes até a idade alvo.",
    rationale:
      "A cada ano, você retira 1/N do patrimônio, onde N é o número de anos restantes " +
      "até a idade alvo. A porcentagem de retirada aumenta a cada ano: aos 35 anos com " +
      "meta de 90, retira-se 1/55 (1,8%); aos 70, retira-se 1/20 (5%). O patrimônio é " +
      "totalmente consumido na idade alvo — ideal para quem não pretende deixar herança.",
    pros: [
      { text: "Cronograma previsível — você sabe exatamente quando o patrimônio acaba" },
      { text: "Renda nominal cresce a cada ano conforme N diminui, criando um colchão natural contra a inflação" },
      { text: "Simples de calcular: basta dividir pelo número de anos restantes" },
    ],
    cons: [
      { text: "Patrimônio chega a zero — não sobra herança" },
      { text: "Risco de viver além da idade alvo sem recursos" },
      { text: "Retiradas nos primeiros anos podem ser muito baixas" },
      { text: "Não garante proteção contra inflação — se a inflação superar o crescimento da retirada, o poder de compra cai" },
    ],
  },
  {
    key: "constant_percentage_age_in_bonds",
    title: "% Constante (Idade em Renda Fixa)",
    subtitle:
      "Retire uma porcentagem fixa do patrimônio por ano, ajustando a alocação para que a % em renda fixa acompanhe sua idade.",
    rationale:
      "Combina a retirada de porcentagem constante com a regra 'idade em renda fixa': " +
      "a cada ano, sua alocação em renda fixa é igual à sua idade (ex: 40 anos = 40% RF, 60% RV). " +
      "Conforme você envelhece, o portfólio fica mais conservador, reduzindo volatilidade. " +
      "Os retornos são menores, mas mais estáveis — suavizando variações na renda.",
    pros: [
      { text: "Alocação se ajusta automaticamente ao risco apropriado para a idade" },
      { text: "Reduz volatilidade progressivamente — menos exposição a quedas do mercado" },
      { text: "Retirada percentual se adapta ao tamanho do portfólio (nunca zera abruptamente)" },
    ],
    cons: [
      { text: "Renda varia ano a ano conforme o portfólio cresce ou encolhe" },
      { text: "Alta alocação em RF em idades avançadas pode não acompanhar a inflação" },
      { text: "Requer rebalanceamento anual entre RF e RV" },
      { text: "Regra de alocação por idade pode ser conservadora demais para alguns perfis" },
    ],
  },
];
