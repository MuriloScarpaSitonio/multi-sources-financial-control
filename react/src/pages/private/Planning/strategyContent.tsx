import type { ReactNode } from "react";

import type { ActiveMethodKey } from "./api";
import Link from "@mui/material/Link";

export type ProConItem = { text: string; galeno?: boolean; ageInBonds?: boolean };

export type DefaultExplained = {
  label: string;
  explanation: ReactNode;
};

export type StrategyContent = {
  title: string;
  subtitle: string;
  rationale: ReactNode;
  defaultsExplained: DefaultExplained[];
  pros: ProConItem[];
  cons: ProConItem[];
};

export const STRATEGY_CONTENT: Record<ActiveMethodKey, StrategyContent> = {
  fire: {
    title: "Retirada constante (FIRE)",
    subtitle:
      "Mantenha seu padrão de vida atual retirando suas despesas " +
      "mensais, ajustadas pela inflação.",
    rationale: (
      <>
        <p>
          Este é o método mais discutido internacionalmente. O famoso{" "}
          <Link
              href="https://en.wikipedia.org/wiki/Trinity_study"
              target="_blank"
              rel="noopener noreferrer"
            >
              Trinity Study
            </Link>{" "}
            analisou qual a taxa anual de retiradas que os aposentados podem sustentar 
            na aposentadoria. Em outras palavras, buscava responder: "qual a taxa na qual o aposentado 
            provavelmente não ficará sem dinheiro?"
        </p>
        <p>
          Ao aplicar esse método, você realiza sua primeira retirada anual com base em uma 
          porcentagem do valor de sua carteira de investimentos (Trinity sugere 4%).
          No segundo ano, o valor da sua retirada não será baseado no valor da sua carteira: 
          em vez disso, você retorna ao valor da retirada do primeiro ano e o 
          ajusta para cima pela taxa de inflação. A lógica é essa: nos anos subsequentes, 
          você retorna ao valor da retirada do ano anterior e o ajusta para cima 
          usando a taxa de inflação atual.
        </p>
        <p>
          Exemplo: se sua carteira vale R$ 1.000.000 e você usa 4%, sua
          primeira retirada anual é R$ 40.000 (R$ 3.333/mês). Se a
          inflação no primeiro ano foi 5%, no segundo ano você retira
          R$ 42.000 (R$ 3.500/mês). Se a inflação no segundo ano foi
          4%, no terceiro ano você retira R$ 43.680 (R$ 3.640/mês) —
          sempre ajustando o valor anterior pela inflação,
          independentemente de quanto a carteira subiu ou caiu.
        </p>
        <p>
          A vantagem desse método é que suas retiradas são previsíveis e constantes em "valores reais".
          Isso significa que o valor da sua retirada anual mantém o mesmo poder de compra real 
          após a inflação. A desvantagem é que, se o mercado iniciar uma queda prolongada pouco 
          antes ou durante seus primeiros anos de aposentadoria, seus ativos podem ser substancialmente 
          ou totalmente esgotados, já que você tende a realizar retiradas maiores, ajustadas pela
          inflação, a cada ano.
        </p>
        <p>
          Você pode preferir esse método se tiver despesas fixas relativamente altas e desejar a 
          previsibilidade de um salário constante.
        </p>
      </>
    ),
    defaultsExplained: [
      {
        label: "O que significa a porcentagem na barra de progresso",
        explanation:
          "A barra mostra quanto do patrimônio FIRE você já acumulou. " +
          "A meta FIRE é: despesas anuais × (100 ÷ taxa). A 4%, " +
          "você precisa de 25× suas despesas anuais. Se o patrimônio " +
          "é 57% dessa meta, a barra mostra 57%. Ao atingir 100%, " +
          "sua retirada (patrimônio × taxa) cobre suas despesas.",
      },
      {
        label: "O que o gráfico mostra",
        explanation:
          "O gráfico simula: 'se eu me aposentasse hoje e retirasse " +
          "minhas despesas atuais todo mês, quanto tempo o " +
          "patrimônio duraria?' São 3 cenários de retorno real: " +
          "pessimista (retorno −1,5pp), esperado (retorno selecionado " +
          "no slider) e otimista (retorno +1,5pp). A linha 'Duração' " +
          "resume em quantos anos cada cenário se esgota. " +
          "Importante: a taxa de saque NÃO afeta o gráfico — ele " +
          "sempre usa suas despesas reais como retirada. A taxa " +
          "afeta apenas a barra de progresso (meta FIRE).",
      },
      {
        label: "O que significa 'Retirada'",
        explanation:
          "'Retirada: R$ X/mês' é quanto você retiraria hoje se " +
          "aplicasse a taxa selecionada ao seu patrimônio atual " +
          "(patrimônio * taxa ÷ 12). 'Despesas: R$ Y/mês' é a " +
          "sua média mensal de despesas (excluindo categorias " +
          "não-FIRE). 'Falta' é a diferença entre os dois.",
      },
      {
        label: "O que significa 'Taxa' (e por que aumentá-la acelera o progresso)",
        explanation:
          "A taxa é o percentual do patrimônio que você pretende " +
          "retirar por ano na aposentadoria. A meta FIRE é o " +
          "inverso: despesas anuais × (100 ÷ taxa). Ou seja, " +
          "quanto maior a taxa, menor o patrimônio-alvo — e, " +
          "portanto, maior o progresso da barra. A 4%, você " +
          "precisa de 25× suas despesas anuais; a 5%, de 20×; " +
          "a 6%, de ~16,7×. Atenção: aumentar a taxa não " +
          "significa que você acumulou mais — significa que você " +
          "está disposto a sacar mais agressivamente, assumindo " +
          "maior risco de esgotar o patrimônio (sequence-of-returns " +
          "risk). O Trinity Study sugere 4% como equilíbrio " +
          "histórico entre renda e sustentabilidade em 30 anos.",
      },
      {
        label: "Meta de 25× despesas anuais (regra dos 4%)",
        explanation:
          <>
            O{" "}
            <Link
              href="https://en.wikipedia.org/wiki/Trinity_study"
              target="_blank"
              rel="noopener noreferrer"
            >
              Trinity Study
            </Link>
            {" "}(estudo americano) mostrou que retirar 4% do portfólio
            inicial e ajustar pela inflação sustentou portfólios por 30+
            anos com mais de 90% de sucesso. 4% = 1/25, então você precisa
            de 25× suas despesas anuais. O indicador mostra quantas vezes
            suas despesas anuais você já acumulou e qual seria sua taxa de
            retirada atual.
          </>,
      },
      {
        label: "Retorno real padrão: 5% a.a.",
        explanation:
          <>
            O Ibovespa{" "}
            <Link
              href="https://insight.economatica.com/desempenho-do-ibovespa-50-anos-de-historia/"
              target="_blank"
              rel="noopener noreferrer"
            >
            rendeu ~2% real a.a. (2000-2024) ou ~6% desde sua criação
            </Link>
            {" "}, dependendo do período. O CDI real{" "}
            <Link
              href="https://borainvestir.b3.com.br/noticias/mercado/cdi-ibovespa-inflacao-veja-quanto-o-premio-do-primeiro-bbb-teria-rendido-de-2002-ate-hoje/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ficou em ~5,5% a.a. (2000-2024)
            </Link>
            {" "}. 5% é um meio-termo entre os dois.
          </>,
      },
      {
        label: "Horizonte padrão: 30 anos",
        explanation:
          <>
            O{" "}
            <Link
              href="https://en.wikipedia.org/wiki/Trinity_study"
              target="_blank"
              rel="noopener noreferrer"
            >
              Trinity Study
            </Link>
            {" "}analisou períodos de 30 anos de aposentadoria com dados
            do mercado americano. É o benchmark mais utilizado para
            planejamento de longo prazo.
          </>,
      },
      {
        label: "Aportes mensais",
        explanation:
          "O slider de aportes mensais começa com a sua poupança média " +
          "recente (média de receitas − média de despesas dos últimos 12 " +
          "meses). Arraste-o para simular outro ritmo de aporte. Enquanto " +
          "o patrimônio está abaixo da meta, o gráfico mostra a trajetória " +
          "histórica do patrimônio crescendo ano a ano com seus aportes, e " +
          "três linhas verticais marcam o tempo até cruzar a meta: " +
          "Otimista (p10), Mediana (p50) e Pessimista (p90). Aumentar o " +
          "valor do slider puxa as três datas para mais cedo; reduzi-lo " +
          "atrasa-as. Depois que a barra atinge 100%, o gráfico volta a " +
          "mostrar a fase de retirada e os aportes deixam de ser " +
          "relevantes.",
      },
    ],
    pros: [
      { text: "Renda mensal previsível e estável" },
      {
        text:
          "Fácil de planejar o orçamento — você sabe exatamente " +
          "quanto vai retirar",
      },
    ],
    cons: [
      {
        text:
          "Portfólio pode se esgotar se retornos reais forem " +
          "abaixo do esperado",
      },
      {
        text:
          "Não se adapta a quedas de mercado — retirada fixa " +
          "mesmo em anos ruins",
      },
      {
        text:
          "Exige monitoramento da sustentabilidade ao longo do tempo",
      },
    ],
  },
  dividends_only: {
    title: "Viver de proventos",
    subtitle:
      "Cubra suas despesas apenas com dividendos e proventos recebidos.",
    rationale: (
      <>
        <p>
          Se você deseja manter o montanto principal do seu portfólio intacto, 
          considere um método em que utilize apenas os dividendos e juros provenientes 
          dos seus investimentos.
        </p>
        <p>
          A vantagem é clara, mas, assim como o método <Link href="/planning/fire">Retirada constante (FIRE)</Link>, 
          há o risco de seus saques flutuarem consideravelmente devido as condições de mercado. 
          Além disso, embora uma alta alocação em ativos focados em dividendos tenda a aumentar seus rendimentos 
          com esse método, ter pouca exposição a investimentos com objetivo de crescimento
          expõe você ao risco de não acompanhar a inflação no longo prazo.
        </p>
        <p>
          Você pode preferir esse método se suas despesas forem pequenas em relação ao tamanho 
          da sua carteira ou se desejar deixar uma grande quantia para seus herdeiros.
        </p>
      </>
    ),
    defaultsExplained: [
      {
        label: "O que significa a porcentagem na barra de progresso",
        explanation:
          "A barra mostra a relacão proventos / despesas. Se seus proventos " +
          "são R$ 6.000/mês e suas despesas são R$ 10.000/mês, " +
          "a barra mostra 60%. Ao atingir 100%, seus proventos " +
          "cobrem todas as suas despesas.",
      },
      {
        label: "O que o gráfico mostra",
        explanation:
          "O gráfico mostra como a renda mensal de proventos " +
          "cresce conforme o patrimônio aumenta, dado o yield " +
          "selecionado. O eixo X é o patrimônio e o eixo Y é a " +
          "renda mensal. A linha tracejada vermelha marca suas " +
          "despesas atuais — quando a linha de proventos cruza " +
          "essa referência, seus proventos cobrem 100% das despesas.",
      },
      {
        label: "O que significam 'Proventos' e 'Despesas' na barra",
        explanation:
          "'Proventos: R$ X/mês' é a sua média mensal real de " +
          "proventos (dividendos, JCP, rendimentos de FIIs) " +
          "dos últimos 12 meses. Se você ajustar o slider de " +
          "yield, o valor passa a ser patrimônio × yield ÷ 12. " +
          "'Despesas: R$ Y/mês' é a sua média mensal de despesas " +
          "(excluindo categorias não-FIRE).",
      },
      {
        label: "Yield inicial: calculado dos seus proventos reais",
        explanation:
          <>
            O yield exibido é calculado automaticamente a partir dos
            seus proventos médios mensais e patrimônio total. Quando
            não há dados, 6% a.a. é usado como referência conservadora
            (o IFIX{" "}
            <Link
              href="https://statusinvest.com.br/indices/ifix"
              target="_blank"
              rel="noopener noreferrer"
            >
              tem um yield médio de ~8% nos últimos 10 anos
            </Link>
            ).
          </>,
      },
      {
        label: "Risco de erosão real após atingir a meta",
        explanation:
          <>
            <p>
              Esta estratégia depende de que seus proventos cresçam em
              linha com a inflação ao longo do tempo. Diferente da
              <i> Retirada constante (FIRE)</i>, que ajusta o saque pelo
              IPCA explicitamente, aqui o "saque" é o que os ativos
              decidirem distribuir — e cabe a você verificar que esse
              fluxo está acompanhando o aumento das despesas reais.
            </p>
            <p>
              O indicador <b>YoY real</b> na linha de diagnóstico mostra
              isso: é o crescimento ano a ano dos seus proventos
              descontando o IPCA. Se ficar consistentemente negativo,
              suas despesas reais estão crescendo mais rápido que sua
              renda passiva e a estratégia perde sustentabilidade no
              longo prazo, mesmo que a barra de cobertura esteja em 100%
              hoje.
            </p>
            <p>
              Mitigação: peso em FIIs com reajuste por IPCA, ações com
              histórico de aumento de dividendos acima da inflação, ou
              uma reserva de patrimônio adicional acima da meta para
              absorver anos de yield real negativo.
            </p>
          </>,
      },
      {
        label: "Como o tempo até a independência é estimado",
        explanation:
          <>
            <p>
              A duração mostrada (ex.: "~5 anos a esse ritmo de aporte") usa
              a fórmula clássica de juros compostos com aportes mensais:
              {" "}
              <i>
                t = ln((meta + c/r) / (atual + c/r)) / ln(1+r)
              </i>
              , onde <i>r</i> é o yield mensal (yield anual ÷ 12) e <i>c</i>{" "}
              é o aporte mensal.
            </p>
            <p>
              <b>Premissa importante:</b> a fórmula trata o yield como a
              taxa de crescimento do patrimônio — ou seja, assume que os
              dividendos são reinvestidos e que os preços dos ativos
              permanecem estáveis em termos reais. Isso é um{" "}
              <b>limite inferior conservador</b>: em mercados em alta o
              tempo real seria menor, pois o patrimônio também cresceria
              por valorização. Use o número como "se nada além de aportes
              e dividendos reinvestidos me levar lá, leva tanto tempo".
            </p>
          </>,
      },
    ],
    pros: [
      {
        text:
          "Patrimônio é preservado integralmente — nunca se vende " +
          "ativos",
      },
      {
        text:
          "Renda gerada sem reduzir o número de ativos na carteira",
      },
    ],
    cons: [
      {
        text:
          "Exige patrimônio significativamente maior para cobrir " +
          "100% das despesas",
      },
      { text: "Dividendos podem ser cortados em crises" },
      {
        text:
          "Concentração em ativos pagadores de dividendos pode " +
          "reduzir diversificação",
      },
    ],
  },
  one_over_n: {
    title: "Retirada 1/N (Esgotamento planejado)",
    subtitle:
      "Divida o patrimônio pelo número de anos restantes até a " +
      "idade alvo.",
    rationale: (
      <>
        <p>
          Um problema comum ao utilizar estratégias típicas de aposendaria, 
          como o método <Link href="/planning/fire">Retirada constante (FIRE)</Link>, 
          é que geralmente pressupõe-se o pior cenário possível, ou seja, a porcentagem 
          recomendada é aquela que, no passado, teria permitido que você superasse a pior crise 
          do mercado, caso ela tivesse ocorrido durante o seu período de aposentadoria.
        </p>
        <p>
          Embora seja geralmente considerado seguro e prudente assumir o pior cenário, vale 
          dizer o óbvio: tais cenários são raros e os mercados tendem a ter um desempenho melhor 
          do que o pior cenário previsto. Logo, não é exagero pensar que se você se planejar para o 
          pior cenário possível é provável que seu portfólio aumente mais do que o estimado 
          sob essas condições – às vezes muito mais.
        </p>
        <p>
          Seguir uma estratégia com esses parâmetros no horizonte pode resultar em uma quantia 
          significativa de dinheiro não gasta durante a aposentadoria. E embora seja comum o 
          objetivo de deixar algum dinheiro para filhos ou parentes, as pessoas também podem se 
          arrepender de não terem gasto um pouco mais enquanto tiveram a oportunidade.
        </p>
        <p>
          Vamos imaginar um cenário simplista onde não haja preocupações com o crescimento do 
          portfólio ou com a inflação: você tem um milhão de reais debaixo do colchão e deseja 
          que ele dure por 10 anos. Uma taxa de retirada "segura" seria, logicamente, gastar 
          1/10 da carteira a cada ano, resultando em uma retirada constante de R$ 100.000 por ano 
          durante os próximos 10 anos.
        </p>
        <p>
          A estratégia 1/N é semelhante. 'N' representa o número de anos que você precisa 
          sacar do portfólio. A cada ano, o valor de 'N' é reajustado, resultando em uma porcentagem 
          maior sendo retirada do portfólio. Exemplo: se N = 20, você retira 1/20 (5%) do portfólio. No
          ano seguinte, 1/19 (5,3%), depois 1/18, e assim por diante. Os saques crescem naturalmente 
          conforme N diminui.
        </p>
        <p>
          Normalmente, sacar uma porcentagem maior é considerado potencialmente inseguro, pois pode 
          resultar no esgotamento total de suas reservas. No entanto, 1/N pressupõe exatamente 
          esta premissa: o gasto de toda a carteira. Suponha que você tenha quatro anos de vida, 
          qual seria a porcentagem de retirada "segura"? Os típicos 4%? Não, já que você sabe que o 
          portfólio só precisa durar quatro anos, isso significa que você pode, ao longo desses anos, 
          retirar 25% do portfólio em cada ano. O preço dessa matemática é o risco de longevidade:
          se viver mais que a idade-alvo, o portfólio já terá se esgotado.
        </p>
      </>
    ),
    defaultsExplained: [
      {
        label: "O que significa a porcentagem na barra de progresso",
        explanation:
          "A barra mostra retirada mensal / despesas. Se a " +
          "retirada 1/N resulta em R$ 2.500/mês e suas despesas " +
          "são R$ 10.000/mês, a barra mostra 25%. Ao atingir " +
          "100%, a retirada 1/N cobre todas as suas despesas.",
      },
      {
        label: "O que o gráfico mostra",
        explanation:
          "O gráfico simula a retirada 1/N ao longo do tempo. " +
          "A cada ano, você retira 1/N do patrimônio restante " +
          "(N = idade alvo − idade atual). A linha de retirada " +
          "cresce conforme N diminui. A linha tracejada vermelha " +
          "marca suas despesas atuais — quando a retirada cruza " +
          "essa referência, o método 1/N cobre 100% das despesas. " +
          "Nos primeiros anos a retirada tende a ser baixa, " +
          "crescendo naturalmente conforme você envelhece.",
      },
      {
        label: "O que significa o R$/mês ao lado da fração 1/N",
        explanation:
          "Na linha 'N = 90 − 35 = 55 anos · 1/55 = 1.8% · " +
          "R$ X/mês', o R$/mês é o seu patrimônio total " +
          "multiplicado pela fração 1/N (considerando o retorno " +
          "real) e dividido por 12. Quanto mais jovem, maior o N " +
          "e menor o saque mensal.",
      },
      {
        label: "Idade alvo padrão: 90 anos",
        explanation:
          <>
            Segundo o{" "}
            <Link href="https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45275-expectativa-de-vida-chega-a-76-6-anos-em-2024" target="_blank" rel="noopener noreferrer">
              IBGE
            </Link>
            {" "}(2024), quem chega aos 60 vive em média até 82,6 anos.
            90 adiciona uma margem de segurança de ~7 anos.
          </>,
      },
      {
        label: "Retorno real padrão: 5% a.a.",
        explanation:
          <>
            <Link href="https://insight.economatica.com/desempenho-do-ibovespa-50-anos-de-historia/" target="_blank" rel="noopener noreferrer">
              Ibovespa
            </Link>
            {" "}real ~2% a.a. (2000-2024) ou ~6% desde sua criação;{" "}
            <Link href="https://borainvestir.b3.com.br/noticias/mercado/cdi-ibovespa-inflacao-veja-quanto-o-premio-do-primeiro-bbb-teria-rendido-de-2002-ate-hoje/" target="_blank" rel="noopener noreferrer">
              CDI
            </Link>
            {" "}real ~5,5% a.a. (2000-2024). 5% é um meio-termo entre os dois.
          </>,
      },
    ],
    pros: [
      {
        text:
          "Cronograma previsível — você sabe exatamente quando " +
          "o patrimônio acaba",
      },
      {
        text:
          "Renda real cresce a cada ano conforme N diminui",
      },
      {
        text:
          "Simples de calcular: basta dividir pelo número de " +
          "anos restantes",
      },
    ],
    cons: [
      { text: "Patrimônio chega a zero — não sobra herança" },
      { text: "Risco de viver além da idade alvo sem recursos" },
      {
        text: "Retiradas nos primeiros anos podem ser muito baixas",
      },
    ],
  },
  vpw: {
    title: "VPW (Saque % Variável)",
    subtitle:
      "A porcentagem de saque aumenta a cada ano conforme você " +
      "envelhece, consumindo o patrimônio até a idade alvo.",
    rationale: (
      <>
        <p>
          O VPW calcula uma tabela de percentuais de retirada
          crescentes, levando em conta a alocação do portfólio entre
          renda variável e fixa e quantos anos faltam até a
          idade-alvo. A cada ano, você multiplica o saldo do
          portfólio pelo percentual daquele ano.
        </p>
        <p>
          Diferente do 1/N (que só divide pelo número de anos
          restantes), o VPW também considera o retorno esperado de
          cada classe de ativo, resultando em saques mais otimizados.
        </p>
        <p>
          O percentual cresce a cada ano. O valor em reais retirado
          flutua conforme o portfólio oscila. O portfólio é consumido
          na idade-alvo.
        </p>
        <p>
          Esse método faz mais sentido se você tem flexibilidade de
          gastos e não pretende deixar herança.
        </p>
      </>
    ),
    defaultsExplained: [
      {
        label: "O que significa a porcentagem na barra de progresso",
        explanation:
          "A barra mostra retirada mensal VPW ÷ despesas. Se o " +
          "VPW calcula R$ 7.000/mês e suas despesas são " +
          "R$ 10.000/mês, a barra mostra 70%. Ao atingir 100%, " +
          "a retirada VPW cobre todas as suas despesas.",
      },
      {
        label: "O que o gráfico mostra",
        explanation:
          "O gráfico simula a retirada VPW ao longo do tempo. " +
          "A cada ano, a taxa de saque é recalculada via fórmula " +
          "PMT com base nos anos restantes e nos retornos esperados " +
          "de cada classe de ativo (RV e RF). A taxa de saque " +
          "cresce conforme você envelhece, mas o valor em reais " +
          "pode subir ou cair dependendo do retorno do portfólio. " +
          "A linha tracejada vermelha marca suas despesas atuais — " +
          "quando a retirada cruza essa referência, o VPW cobre " +
          "100% das despesas.",
      },
      {
        label: "O que significa o R$/mês ao lado da taxa de saque",
        explanation:
          "Na linha 'Saque: X% a.a. · R$ Y/mês', o R$/mês é " +
          "o seu patrimônio total multiplicado pela taxa VPW " +
          "do ano atual e dividido por 12. A taxa VPW é " +
          "calculada via fórmula financeira (PMT) considerando " +
          "sua idade, idade alvo, alocação entre RF e RV, e " +
          "retornos esperados de cada classe. A taxa aumenta " +
          "a cada ano conforme você envelhece.",
      },
      {
        label: "Idade alvo padrão: 99 anos",
        explanation:
          <>
            A{" "}
            <Link href="https://www.bogleheads.org/wiki/Variable_percentage_withdrawal" target="_blank" rel="noopener noreferrer">
              planilha oficial do VPW
            </Link>
            {" "}usa 'last withdrawal age of 99' e limita o saque a 10%
            do portfólio como segurança.
          </>,
      },
      {
        label: "Retorno real RV: 5% a.a.",
        explanation:
          <>
            O{" "}
            <Link href="https://insight.economatica.com/desempenho-do-ibovespa-50-anos-de-historia/" target="_blank" rel="noopener noreferrer">
              Ibovespa
            </Link>
            {" "}rendeu ~2% real a.a. (2000-2024) ou ~6% desde sua criação.
            5% é um meio-termo entre essas duas janelas.
          </>,
      },
      {
        label: "Retorno real RF: 4% a.a.",
        explanation:
          <>
            O{" "}
            <Link href="https://borainvestir.b3.com.br/noticias/mercado/cdi-ibovespa-inflacao-veja-quanto-o-premio-do-primeiro-bbb-teria-rendido-de-2002-ate-hoje/" target="_blank" rel="noopener noreferrer">
              CDI
            </Link>
            {" "}real ficou em ~5,5% a.a. (2000-2024). 4% é um desconto
            conservador sobre a média histórica brasileira.
          </>,
      },
    ],
    pros: [
      {
        text:
          "Saque se adapta automaticamente à idade e à alocação " +
          "do portfólio",
      },
      {
        text:
          "Renda cresce ao longo do tempo — compensa parcialmente " +
          "a inflação",
      },
      {
        text:
          "Baseado em fórmula financeira robusta (PMT), não em " +
          "regras empíricas",
      },
    ],
    cons: [
      {
        text: "Renda varia ano a ano conforme o portfólio oscila",
      },
      {
        text:
          "Patrimônio chega próximo de zero — não sobra herança " +
          "significativa",
      },
      {
        text: "Risco de longevidade se viver além da idade alvo",
      },
    ],
  },
};

export {
  GALENO_RATIONALE,
  GALENO_PROS,
  GALENO_CONS,
  AGE_IN_BONDS_TITLES,
} from "./consts";
