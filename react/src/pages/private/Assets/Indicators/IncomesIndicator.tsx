import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { Indicator } from "../../components";
import PercentageChangeSecondaryIndicator from "./PercentageChangeSecondaryIndicator";
import { useIncomesIndicators } from "../../Incomes/Indicators/hooks";
import { endOfMonth, startOfMonth } from "date-fns";

const customEndOfMonth = (date: Date) => {
  const result = endOfMonth(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const IncomesIndicator = () => {
  const now = new Date();
  const { data, isPending, isError } = useIncomesIndicators({
    startDate: startOfMonth(now),
    endDate: customEndOfMonth(now),
  });
  const variant = data && (data.diff ?? 0) > 0 ? "success" : "danger";

  return (
    <Indicator
      title="Rendimentos"
      tooltipText="Creditados, no mês atual"
      value={data?.credited}
      secondaryIndicator={
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
      }
      Icon={MonetizationOnOutlinedIcon}
      variant={variant}
      isLoading={isPending}
      isError={isError}
    />
  );
};

export default IncomesIndicator;
