import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { useQuery } from "@tanstack/react-query";

import { Indicator } from "../../components";
import { getIndicators } from "../../../../api/incomes";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";

const IncomesIndicator = () => {
  const { data, isPending, isError } = useQuery({
    queryKey: ["incomes-indicators"],
    queryFn: getIndicators,
  });
  const variant = data && data.diff_percentage > 0 ? "success" : "danger";

  return (
    <Indicator
      title="Rendimentos"
      tooltipText="Valor de referência: média mensal dos últimos 12 meses"
      value={data?.current_credited}
      secondaryIndicator={
        <PercentageChangeSecondaryIndicator
          value={data?.diff_percentage}
          isLoading={isPending}
          variant={variant}
          tooltipText={`Média: R$ ${data?.avg.toLocaleString("pt-br", {
            minimumFractionDigits: 2,
          })}`}
        />
      }
      Icon={MonetizationOnOutlinedIcon}
      variant={variant}
      isLoading={isPending}
      isError={isError}
    />
  );
};

export default IncomesIndicator;
