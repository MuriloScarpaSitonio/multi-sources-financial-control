import { useContext } from "react";

import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { Indicator } from "../../components";
import PercentageChangeSecondaryIndicator from "../../Assets/Indicators/PercentageChangeSecondaryIndicator";
import { useTransactionsIndicators } from "./hooks";
import { Colors, FontSizes, Text } from "../../../../design-system";
import { TransactionsContext } from "../context";

const Indicators = () => {
  const { startDate, endDate } = useContext(TransactionsContext);

  const { data, isPending, isError } = useTransactionsIndicators({
    startDate,
    endDate,
  });
  const isFilteringEntireMonth = !isPending && data?.diff !== undefined;
  const variant = data && (data.diff ?? 0) > 0 ? "success" : "danger";

  return (
    <Indicator
      title="Total movimentado"
      tooltipText="Compras - vendas, no período selecionado"
      value={(data?.bought ?? 0) - (data?.sold ?? 0)}
      secondaryIndicator={
        isFilteringEntireMonth && (
          <PercentageChangeSecondaryIndicator
            value={data?.diff}
            isLoading={isPending}
            variant={variant}
            tooltipText={`Média dos últimos 12 meses: R$ ${data?.avg.toLocaleString(
              "pt-br",
              {
                minimumFractionDigits: 2,
              },
            )}`}
          />
        )
      }
      extra={
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral300}>
          {`${
            data?.bought?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
            }) ?? 0
          } (compras) - ${
            data?.sold?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
            }) ?? 0
          } (vendas)`}
        </Text>
      }
      Icon={MonetizationOnOutlinedIcon}
      variant={variant}
      isLoading={isPending}
      isError={isError}
    />
  );
};

export default Indicators;
