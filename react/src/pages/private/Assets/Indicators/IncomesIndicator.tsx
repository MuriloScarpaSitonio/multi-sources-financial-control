import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { Indicator } from "../../components";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";
import { useIncomesIndicators } from "./hooks";

const IncomesIndicator = () => {
  const { data, isPending, isError } = useIncomesIndicators();
  const variant = data && data.diff_percentage > 0 ? "success" : "danger";

  return (
    <Indicator
      title="Rendimentos"
      tooltipText="No mês atual"
      value={data?.current_credited}
      secondaryIndicator={
        <PercentageChangeSecondaryIndicator
          value={data?.diff_percentage}
          isLoading={isPending}
          variant={variant}
          tooltipText={`Média dos últimos 12 meses: R$ ${data?.avg.toLocaleString(
            "pt-br",
            {
              minimumFractionDigits: 2,
            },
          )}`}
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
