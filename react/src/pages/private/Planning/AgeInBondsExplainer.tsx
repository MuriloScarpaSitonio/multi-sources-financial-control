import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import { formatCurrency } from "../utils";

const computeAge = (dateOfBirth: string): number => {
  const birth = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

type Props = {
  dateOfBirth: string | null;
  fixedIncomeTotal: number;
  variableIncomeTotal: number;
};

const AgeInBondsExplainer = ({
  dateOfBirth,
  fixedIncomeTotal,
  variableIncomeTotal,
}: Props) => {
  const { hideValues } = useHideValues();

  const currentAge = dateOfBirth ? computeAge(dateOfBirth) : null;
  const investmentTotal = fixedIncomeTotal + variableIncomeTotal;
  const currentBondPct =
    investmentTotal > 0 ? (fixedIncomeTotal / investmentTotal) * 100 : 0;
  const targetBondPct = currentAge !== null ? Math.min(currentAge, 100) : 0;
  const rebalanceAmount =
    investmentTotal > 0
      ? (targetBondPct / 100) * investmentTotal - fixedIncomeTotal
      : 0;
  const isOnTarget = Math.abs(currentBondPct - targetBondPct) <= 5;

  const hasUserData = currentAge !== null && investmentTotal > 0;

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Stack gap={2}>
        <Text weight={FontWeights.SEMI_BOLD} size={FontSizes.MEDIUM}>
          Como funciona a alternativa Idade em Renda Fixa
        </Text>

        {hasUserData && (
          <Text size={FontSizes.SMALL} color={Colors.neutral400}>
            Hoje, aos <strong>{currentAge} anos</strong>, sua meta de renda fixa
            é <strong>{targetBondPct}%</strong>. Você está em{" "}
            <strong
              style={{
                color: getColor(isOnTarget ? Colors.brand : Colors.danger200),
              }}
            >
              {currentBondPct.toFixed(0)}%
            </strong>
            {isOnTarget ? " — alinhado." : "."}
            {!isOnTarget &&
              Math.abs(rebalanceAmount) > 0 &&
              !hideValues && (
                <>
                  {" "}
                  Considere mover{" "}
                  <strong>
                    {formatCurrency(Math.abs(rebalanceAmount))}
                  </strong>{" "}
                  {rebalanceAmount > 0 ? "para RF" : "para RV"} para alinhar.
                </>
              )}
          </Text>
        )}

        <Text size={FontSizes.SMALL} color={Colors.neutral400}>
          A regra <strong>RF% = idade</strong> protege contra o maior risco da
          aposentadoria precoce: uma sequência ruim de retornos nos primeiros
          anos. Uma queda de mercado logo no início corrói o portfólio antes
          que ele tenha tempo de se recuperar; uma alocação progressivamente
          mais defensiva reduz essa exposição justamente quando o horizonte de
          investimento encurta.
        </Text>

        <Text size={FontSizes.SMALL} color={Colors.neutral400}>
          Quando a alternativa está desligada, a simulação histórica usa sua
          alocação atual e mantém ela fixa durante todo o período. Quando
          você ativa, a alocação muda a cada ano simulado: a fração em renda
          fixa aumenta 1 ponto percentual por ano, acompanhando seu
          envelhecimento. Por isso a barra principal pode se mexer ao ativar
          — ela passa a refletir como sua carteira realmente vai se
          transformar com o tempo.
        </Text>

        <Text size={FontSizes.SMALL} color={Colors.neutral400}>
          É uma das regras mais conhecidas, mas não a única defensável.{" "}
          <Link
            href="https://www.financialplanningassociation.org/article/journal/JAN14-reducing-retirement-risk-rising-equity-glide-path"
            target="_blank"
            rel="noopener noreferrer"
          >
            Pfau e Kitces (2014)
          </Link>{" "}
          mostraram que o caminho oposto — começar a aposentadoria com mais
          renda fixa e migrar gradualmente para renda variável conforme o
          tempo passa — pode oferecer melhor proteção contra o pior cenário
          de sequência de retornos. Idade em RF é o padrão consensual, não
          consenso unânime.
        </Text>

        <Stack direction="row" gap={4}>
          <Stack gap={1} flex={1}>
            <Text
              size={FontSizes.SMALL}
              weight={FontWeights.SEMI_BOLD}
              color={Colors.brand500}
            >
              Prós
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              + Alocação se ajusta automaticamente ao risco apropriado para a
              idade
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              + Reduz volatilidade progressivamente conforme o horizonte
              encurta
            </Text>
          </Stack>
          <Stack gap={1} flex={1}>
            <Text
              size={FontSizes.SMALL}
              weight={FontWeights.SEMI_BOLD}
              color={Colors.danger200}
            >
              Contras
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              − Alta alocação em RF em idades avançadas pode reduzir
              crescimento real
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              − Glide path crescente (oposto) pode proteger melhor contra
              risco de sequência
            </Text>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default AgeInBondsExplainer;
