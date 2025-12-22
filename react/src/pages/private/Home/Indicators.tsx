import { useMemo } from "react";

import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";

import { startOfMonth, subDays } from "date-fns";

import { Indicator } from "../components";
import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  InvestmentUpIcon,
  Text,
} from "../../../design-system";
import { useBankAccount } from "../Expenses/hooks";
import { useAssetsIndicators } from "../Assets/Indicators/hooks";
import AssetPercentageChangeSecondaryIndicator from "../Assets/Indicators/PercentageChangeSecondaryIndicator";
import RoiSecondaryIndicator from "../Assets/Indicators/RoiSecondaryIndicator";
import { useExpensesIndicators } from "../Expenses/Indicators/hooks";
import { customEndOfMonth } from "../utils";
import ExpensePercentageChangeSecondaryIndicator from "../Expenses/Indicators/PercentageChangeSecondaryIndicator";
import { useRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import ExpenseRevenuesRatioLinearProgress from "../Expenses/Indicators/ExpenseRevenuesRatioLinearProgress";
import { IndicatorBox } from "../Expenses/Indicators/components";
import { useIncomesSumCredited } from "../Incomes/Indicators/hooks";
import { useHideValues } from "../../../hooks/useHideValues";

const PatrimonyCompositionIndicator = ({
  investmentsTotal,
  bankAmount,
  isLoading,
}: {
  investmentsTotal: number;
  bankAmount: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const total = investmentsTotal + bankAmount;
  const investmentsPercentage = total > 0 ? (investmentsTotal / total) * 100 : 0;
  const bankPercentage = total > 0 ? (bankAmount / total) * 100 : 0;

  if (isLoading) {
    return (
      <Stack sx={{ mt: 2 }}>
        <Skeleton width="100%" height={80} sx={{ borderRadius: "10px" }} />
      </Stack>
    );
  }

  return (
    <Stack sx={{ mt: 2 }}>
      <Tooltip
        title="Composição do patrimônio total: investimentos (ativos de renda variável) + saldo em conta corrente"
        arrow
        placement="top"
      >
        <div>
          <IndicatorBox variant="success" width="100%" height="72px">
            <Text size={FontSizes.SMALL} color={Colors.neutral300}>
              {hideValues ? (
                <Skeleton
                  component="span"
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "40px",
                    display: "inline-block",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  component="span"
                  size={FontSizes.SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral0}
                >
                  {investmentsPercentage.toFixed(0)}%
                </Text>
              )}{" "}
              em investimentos,{" "}
              {hideValues ? (
                <Skeleton
                  component="span"
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "40px",
                    display: "inline-block",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  component="span"
                  size={FontSizes.SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral0}
                >
                  {bankPercentage.toFixed(0)}%
                </Text>
              )}{" "}
              em conta corrente
            </Text>
          </IndicatorBox>
        </div>
      </Tooltip>
    </Stack>
  );
};

const MonthlyBalanceIndicator = ({
  revenues,
  expenses,
  isLoading,
}: {
  revenues: number;
  expenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const balance = revenues - expenses;
  const isPositive = balance >= 0;

  if (isLoading) {
    return <Skeleton width="100%" height={50} sx={{ borderRadius: "10px" }} />;
  }

  return (
    <Tooltip
      title="Receitas menos despesas do mês atual"
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox variant={isPositive ? "success" : "danger"} width="100%">
          <Text size={FontSizes.SMALL} color={Colors.neutral300}>
            {isPositive ? "Você está economizando " : "Você está gastando "}
            {hideValues ? (
              <Skeleton
                component="span"
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "70px",
                  display: "inline-block",
                }}
                animation={false}
              />
            ) : (
              <Text
                component="span"
                size={FontSizes.SMALL}
                weight={FontWeights.BOLD}
                color={Colors.neutral0}
              >
                R${" "}
                {Math.abs(balance).toLocaleString("pt-br", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )}
            {isPositive ? " neste mês" : " a mais que sua receita"}
          </Text>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const SavingsRateIndicator = ({
  revenues,
  expenses,
  isLoading,
}: {
  revenues: number;
  expenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const savingsRate = revenues > 0 ? ((revenues - expenses) / revenues) * 100 : 0;
  const isPositive = savingsRate >= 0;

  if (isLoading) {
    return <Skeleton width="100%" height={50} sx={{ borderRadius: "10px" }} />;
  }

  return (
    <Tooltip
      title="Percentual da receita do mês atual que está sendo poupado (receitas - despesas) / receitas"
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox variant={isPositive ? "success" : "danger"} width="100%">
          <Text size={FontSizes.SMALL} color={Colors.neutral300}>
            {hideValues ? (
              <Skeleton
                component="span"
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "40px",
                  display: "inline-block",
                }}
                animation={false}
              />
            ) : (
              <Text
                component="span"
                size={FontSizes.SMALL}
                weight={FontWeights.BOLD}
                color={Colors.neutral0}
              >
                {Math.abs(savingsRate).toFixed(0)}%
              </Text>
            )}{" "}
            {isPositive
              ? "da sua receita está sendo poupada neste mês"
              : "acima da sua receita em gastos"}
          </Text>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const EmergencyFundIndicator = ({
  bankAmount,
  avgExpenses,
  isLoading,
}: {
  bankAmount: number;
  avgExpenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const monthsCovered = avgExpenses > 0 ? bankAmount / avgExpenses : 0;
  const isHealthy = monthsCovered >= 3;

  if (isLoading) {
    return <Skeleton width="100%" height={50} sx={{ borderRadius: "10px" }} />;
  }

  return (
    <Tooltip
      title="Saldo em conta corrente dividido pela média mensal de despesas dos últimos 12 meses. Indicação de successo (reserva de emergência saudável) se >= 3 meses"
      arrow
      placement="top"
    >
      <div>
        <IndicatorBox variant={isHealthy ? "success" : "danger"} width="100%">
          <Text size={FontSizes.SMALL} color={Colors.neutral300}>
            Seu saldo cobre{" "}
            {hideValues ? (
              <Skeleton
                component="span"
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "30px",
                  display: "inline-block",
                }}
                animation={false}
              />
            ) : (
              <Text
                component="span"
                size={FontSizes.SMALL}
                weight={FontWeights.BOLD}
                color={Colors.neutral0}
              >
                {monthsCovered.toFixed(1)}
              </Text>
            )}{" "}
            {monthsCovered === 1 ? "mês" : "meses"} de despesas
          </Text>
        </IndicatorBox>
      </div>
    </Tooltip>
  );
};

const CreditedPassiveIncomesLast90DaysIndicator = () => {
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    return {
      startDate: subDays(now, 90),
      endDate: now,
    };
  }, []);

  const { data: { total: incomesSumCredited } = { total: 0 }, isPending: isLoading } =
    useIncomesSumCredited({ startDate, endDate });

  const { hideValues } = useHideValues();

  if (isLoading) {
    return (
      <Stack sx={{ mt: 2 }}>
        <Skeleton width="100%" height={80} sx={{ borderRadius: "10px" }} />
      </Stack>
    );
  }

  return (
    <Stack sx={{ mt: 2 }}>
      <Tooltip
        title="Soma de proventos de renda variável creditados nos últimos 90 dias"
        arrow
        placement="top"
      >
        <div>
          <IndicatorBox
            variant={incomesSumCredited > 0 ? "success" : "danger"}
            width="100%"
            height="72px"
          >
            <Text size={FontSizes.SMALL} color={Colors.neutral300}>
              Você recebeu{" "}
              {hideValues ? (
                <Skeleton
                  component="span"
                  sx={{
                    bgcolor: getColor(Colors.neutral300),
                    width: "60px",
                    display: "inline-block",
                  }}
                  animation={false}
                />
              ) : (
                <Text
                  component="span"
                  size={FontSizes.SMALL}
                  weight={FontWeights.BOLD}
                  color={Colors.neutral0}
                >
                  R${" "}
                  {incomesSumCredited.toLocaleString("pt-br", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              )}{" "}
              em proventos nos últimos 90 dias
            </Text>
          </IndicatorBox>
        </div>
      </Tooltip>
    </Stack>
  );
};

const Indicators = () => {
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: customEndOfMonth(now),
    };
  }, []);

  const {
    data: assetsIndicators,
    isPending: isAssetsIndicatorsLoading,
    isError: isAssetsIndicatorsError,
  } = useAssetsIndicators();
  const {
    data: { amount: bankAmount } = { amount: 0 },
    isPending: isBankAccountLoading,
    isError: isBankAccountError,
  } = useBankAccount();

  const {
    data: expensesIndicators,
    isPending: isExpensesIndicatorsLoading,
    isError: isExpensesIndicatorsError,
  } = useExpensesIndicators({ startDate, endDate });

  const {
    data: revenuesIndicators,
    isPending: isRevenuesIndicatorsLoading,
    isError: isRevenuesIndicatorsError,
  } = useRevenuesIndicators({ startDate, endDate });

  const percentage = useMemo(() => {
    if (expensesIndicators && revenuesIndicators)
      return (
        ((expensesIndicators?.total ?? 0) / (revenuesIndicators?.total || 1)) *
        100
      );
    return 0;
  }, [expensesIndicators, revenuesIndicators]);

  const isLoading = isAssetsIndicatorsLoading || isBankAccountLoading;
  const isError = isAssetsIndicatorsError || isBankAccountError;

  return (
    <Grid container spacing={4}>
      <Grid item xs={3}>
        <Indicator
          title="Patrimônio total"
          tooltipText="Soma do valor atual dos investimentos em renda variável + saldo em conta corrente. Variação comparada ao mês anterior"
          value={(assetsIndicators?.total ?? 0) + bankAmount}
          secondaryIndicator={
            <AssetPercentageChangeSecondaryIndicator
              value={assetsIndicators?.total_diff_percentage}
              variant={
                // this is essentially the diff between total and the last entry
                // of useAssetsTotalInvestedHistory
                // TODO: consider calculating this in the FE to avoid hitting
                // the DB twice
                assetsIndicators && assetsIndicators.total_diff_percentage > 0
                  ? "success"
                  : "danger"
              }
              isLoading={isLoading}
              text="no último mês"
            />
          }
          Icon={MonetizationOnOutlinedIcon}
          variant="success"
          isLoading={isLoading}
          isError={isError}
        />
        <PatrimonyCompositionIndicator
          investmentsTotal={assetsIndicators?.total ?? 0}
          bankAmount={bankAmount}
          isLoading={isLoading}
        />
      </Grid>
      <Grid item xs={3}>
        <Indicator
          title="ROI (Lucro/Prejuízo)"
          tooltipText="Retorno sobre investimento: soma do lucro/prejuízo de posições abertas e fechadas em renda variável"
          value={
            (assetsIndicators?.ROI_opened ?? 0) +
            (assetsIndicators?.ROI_closed ?? 0)
          }
          secondaryIndicator={
            <RoiSecondaryIndicator
              value={assetsIndicators?.ROI_opened}
              variant={
                assetsIndicators && assetsIndicators.ROI_opened > 0
                  ? "success"
                  : "danger"
              }
              isLoading={isAssetsIndicatorsLoading}
            />
          }
          Icon={InvestmentUpIcon as typeof SvgIcon}
          variant={
            assetsIndicators && assetsIndicators.ROI > 0 ? "success" : "danger"
          }
          isLoading={isAssetsIndicatorsLoading}
          isError={isAssetsIndicatorsError}
        />
        <CreditedPassiveIncomesLast90DaysIndicator />
      </Grid>
      <Grid item xs={6}>
        <Stack gap={1}>
          <Stack direction="row" gap={4}>
            <Indicator
              title="Despesas"
              tooltipText="Total de despesas no mês atual. Variação comparada à média mensal dos últimos 12 meses"
              value={expensesIndicators?.total}
              secondaryIndicator={
                <ExpensePercentageChangeSecondaryIndicator
                  value={expensesIndicators?.diff}
                  variant={
                    expensesIndicators && (expensesIndicators.diff ?? 0) < 0
                      ? "success"
                      : "danger"
                  }
                  isIconInverse
                  isLoading={isExpensesIndicatorsLoading}
                />
              }
              Icon={MonetizationOnOutlinedIcon}
              variant="danger"
              isLoading={isExpensesIndicatorsLoading}
              isError={isExpensesIndicatorsError}
              sx={{ width: "50%" }}
            />
            <Indicator
              title="Receitas"
              tooltipText="Total de receitas no mês atual. Variação comparada à média mensal dos últimos 12 meses"
              value={revenuesIndicators?.total}
              secondaryIndicator={
                <ExpensePercentageChangeSecondaryIndicator
                  value={revenuesIndicators?.diff}
                  variant={
                    revenuesIndicators && (revenuesIndicators.diff ?? 0) > 0
                      ? "success"
                      : "danger"
                  }
                  isLoading={isRevenuesIndicatorsLoading}
                />
              }
              Icon={MonetizationOnOutlinedIcon}
              variant="success"
              isLoading={isRevenuesIndicatorsLoading}
              isError={isRevenuesIndicatorsError}
              sx={{ width: "50%" }}
            />
          </Stack>
          <ExpenseRevenuesRatioLinearProgress
            percentage={percentage}
            isLoading={
              isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading
            }
          />
          <Stack direction="row" gap={2} sx={{ mt: 2 }}>
            <MonthlyBalanceIndicator
              revenues={revenuesIndicators?.total ?? 0}
              expenses={expensesIndicators?.total ?? 0}
              isLoading={isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading}
            />
            <SavingsRateIndicator
              revenues={revenuesIndicators?.total ?? 0}
              expenses={expensesIndicators?.total ?? 0}
              isLoading={isExpensesIndicatorsLoading || isRevenuesIndicatorsLoading}
            />
            <EmergencyFundIndicator
              bankAmount={bankAmount}
              avgExpenses={expensesIndicators?.avg ?? 0}
              isLoading={isExpensesIndicatorsLoading || isBankAccountLoading}
            />
          </Stack>
        </Stack>
      </Grid>
    </Grid>
  );
};

export default Indicators;
