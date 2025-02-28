import { useContext, useMemo } from "react";

import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

import { Indicator } from "../../components";
import PercentageChangeSecondaryIndicator from "../../Assets/Indicators/PercentageChangeSecondaryIndicator";
import { useIncomesIndicators, useIncomesSumProvisionedFuture } from "./hooks";
import {
  Colors,
  FontSizes,
  isFilteringWholeMonth,
  Text,
} from "../../../../design-system";
import { IncomesContext } from "../context";

const Indicators = () => {
  const { startDate, endDate } = useContext(IncomesContext);
  const isFilteringEntireMonth = useMemo(
    () => isFilteringWholeMonth(startDate, endDate),
    [startDate, endDate],
  );

  const {
    data,
    isPending: isIndicatorsDataPending,
    isError: isIndicatorsDataError,
  } = useIncomesIndicators({
    startDate,
    endDate,
  });
  const {
    data: { total: provisioned } = {},
    isPending: isProvisionedDataPending,
    isError: isProvisionedDataError,
  } = useIncomesSumProvisionedFuture();
  const isPending = isIndicatorsDataPending || isProvisionedDataPending;
  const isError = isIndicatorsDataError || isProvisionedDataError;

  const variant = data && (data.diff ?? 0) > 0 ? "success" : "danger";

  return (
    <Indicator
      title="Rendimentos"
      tooltipText="Total creditado, no período selecionado"
      value={data?.credited}
      secondaryIndicator={
        isFilteringEntireMonth && (
          <PercentageChangeSecondaryIndicator
            value={data?.diff}
            isLoading={isIndicatorsDataPending}
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
          {`R$ ${
            provisioned?.toLocaleString("pt-br", {
              minimumFractionDigits: 2,
            }) ?? 0
          } provisionados`}
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
