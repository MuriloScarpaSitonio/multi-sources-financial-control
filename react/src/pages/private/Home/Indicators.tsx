import { useMemo } from "react";

import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import LinearProgress, { linearProgressClasses } from "@mui/material/LinearProgress";
import { styled } from "@mui/material/styles";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import SvgIcon from "@mui/material/SvgIcon";

import { startOfMonth } from "date-fns";

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
import { useHomeExpensesIndicators } from "../Expenses/Indicators/hooks";
import { customEndOfMonth } from "../utils";
import ExpensePercentageChangeSecondaryIndicator from "../Expenses/Indicators/PercentageChangeSecondaryIndicator";
import { useRevenuesIndicators } from "../Revenues/hooks/useRevenuesIndicators";
import ExpenseRevenuesRatioLinearProgress from "../Expenses/Indicators/ExpenseRevenuesRatioLinearProgress";
import { useHideValues } from "../../../hooks/useHideValues";

const FIRELinearProgress = styled(LinearProgress)(({ value }) => ({
  height: 24,
  borderRadius: 10,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: getColor(Colors.neutral600),
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 10,
    backgroundColor:
      value && value >= 100 ? getColor(Colors.brand) : getColor(Colors.danger200),
  },
}));

const formatCurrency = (value: number) =>
  `R$ ${Math.abs(value).toLocaleString("pt-br", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const FIREProgressBar = ({
  patrimonyTotal,
  avgExpenses,
  isLoading,
}: {
  patrimonyTotal: number;
  avgExpenses: number;
  isLoading: boolean;
}) => {
  const { hideValues } = useHideValues();
  const annualExpenses = avgExpenses * 12;
  const fireNumber = annualExpenses * 25;
  const fireProgress = fireNumber > 0 ? (patrimonyTotal / fireNumber) * 100 : 0;

  if (isLoading) {
    return <Skeleton height={48} sx={{ borderRadius: "10px" }} />;
  }

  const annualExpensesFormatted = hideValues ? "***" : formatCurrency(annualExpenses);
  const tooltipTitle = `Patrimônio / (despesas anuais × 25). Despesas anuais: ${annualExpensesFormatted}. Meta: acumular 25x suas despesas anuais para viver dos rendimentos (regra dos 4%)`;

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      placement="top"
    >
      <Stack gap={0.5}>
        <div style={{ position: "relative" }}>
          <FIRELinearProgress
            variant="determinate"
            value={Math.min(fireProgress, 100)}
          />
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              px: 1.5,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
            }}
          >
            <Text
              color={Colors.neutral0}
              weight={FontWeights.MEDIUM}
              size={FontSizes.SEMI_SMALL}
            >
              Independência financeira (FIRE)
            </Text>
            {hideValues ? (
              <Skeleton
                sx={{
                  bgcolor: getColor(Colors.neutral300),
                  width: "60px",
                }}
                animation={false}
              />
            ) : (
              <Text
                color={Colors.neutral0}
                weight={FontWeights.SEMI_BOLD}
                size={FontSizes.SEMI_SMALL}
              >
                {fireProgress.toFixed(1)}%
              </Text>
            )}
          </Stack>
        </div>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          Progresso rumo à independência financeira (regra dos 4%)
        </Text>
    </Stack>
    </Tooltip>
  );
};

const Indicators = () => {
  const { hideValues } = useHideValues();
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
  } = useAssetsIndicators({ includeYield: true });
  const {
    data: { amount: bankAmount } = { amount: 0 },
    isPending: isBankAccountLoading,
    isError: isBankAccountError,
  } = useBankAccount();

  const {
    data: expensesIndicators,
    isPending: isExpensesIndicatorsLoading,
    isError: isExpensesIndicatorsError,
  } = useHomeExpensesIndicators();

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
      <Grid item xs={6}>
        <Stack gap={1}>
          <Stack direction="row" gap={4}>
        <Indicator
          title="Patrimônio total"
              tooltipText="Soma do valor atual dos investimentos + saldo em conta corrente. Variação comparada ao mês anterior"
          value={(assetsIndicators?.total ?? 0) + bankAmount}
          secondaryIndicator={
            <AssetPercentageChangeSecondaryIndicator
              value={assetsIndicators?.total_diff_percentage}
              variant={
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
              sx={{ width: "50%" }}
        />
        <Indicator
          title="ROI (Lucro/Prejuízo)"
              tooltipText="Retorno sobre investimento: soma do lucro/prejuízo de posições abertas e fechadas de investimentos"
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
              sx={{ width: "50%" }}
            />
          </Stack>
          <FIREProgressBar
            patrimonyTotal={(assetsIndicators?.total ?? 0) + bankAmount}
            avgExpenses={expensesIndicators?.avg ?? 0}
            isLoading={isLoading || isExpensesIndicatorsLoading}
          />
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack gap={1}>
          <Stack direction="row" gap={4}>
            <Indicator
              title="Despesas"
              tooltipText={`Total de despesas no mês atual. Variação comparada à média mensal dos últimos 12 meses (${expensesIndicators?.avg ? (hideValues ? "***" : formatCurrency(expensesIndicators.avg)) : "N/A"})`}
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
              tooltipText={`Total de receitas no mês atual. Variação comparada à média mensal dos últimos 12 meses (${revenuesIndicators?.avg ? (hideValues ? "***" : formatCurrency(revenuesIndicators.avg)) : "N/A"})`}
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
        </Stack>
      </Grid>
    </Grid>
  );
};

export default Indicators;
