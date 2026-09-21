import Stack from "@mui/material/Stack";
import { Colors, FontSizes, Text } from "../../../design-system";
import type { ExtendedAccumulationResult } from "./fireBootstrap";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const FireAccumulationExtensionNotice = ({
  result,
  hideValues,
  horizon,
}: {
  result: ExtendedAccumulationResult;
  hideValues: boolean;
  horizon: number;
}) => (
  <Stack gap={0.5} sx={{ mb: 1.5 }}>
    <Text size={FontSizes.EXTRA_SMALL}>
      Aportes por mais {result.extraYears}{" "}
      {result.extraYears === 1 ? "ano" : "anos"} após atingir a meta FIRE.
    </Text>
    {result.medianYearsToRetirement !== null &&
    result.medianStartingBalance !== null ? (
      <>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          Início das retiradas em {result.medianYearsToRetirement} anos ·
          Patrimônio projetado:{" "}
          {hideValues ? "***" : money.format(result.medianStartingBalance)}{" "}
          (medianas).
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          O horizonte de {horizon} anos começa na aposentadoria.
        </Text>
        {result.retirementStartRate < 1 && (
          <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
            Os resultados de retirada consideram os{" "}
            {(result.retirementStartRate * 100).toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
            })}
            % dos cenários que chegaram à aposentadoria.
          </Text>
        )}
      </>
    ) : (
      <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
        Nenhum cenário atingiu a meta em 60 anos de acumulação. Não há projeção
        de retiradas para este plano.
      </Text>
    )}
  </Stack>
);
export default FireAccumulationExtensionNotice;
