import Box from "@mui/material/Box";
import { useQuery } from "@tanstack/react-query";
import { Text, FontSizes, FontWeights } from "../../../design-system";
import { useHideValues } from "../../../hooks/useHideValues";
import {
  getSum as getExpensesSum,
  type ExpenseListParams,
} from "./api/expenses";
import {
  getSum as getRevenuesSum,
  type RevenueListParams,
} from "../Revenues/api";

export default function FullHistorySearchTotal({
  resource,
  filters,
}: {
  resource: "expenses" | "revenues";
  filters: ExpenseListParams | RevenueListParams;
}) {
  const { hideValues } = useHideValues();
  const { data, isFetching, isError } = useQuery({
    queryKey: [resource, "search", "total", filters],
    queryFn: () =>
      resource === "expenses"
        ? getExpensesSum(filters)
        : getRevenuesSum(filters),
    staleTime: 0,
    refetchOnMount: true,
    retry: false,
  });
  const text = hideValues
    ? "Total: •••"
    : isFetching || (!data && !isError)
      ? "Calculando total…"
      : isError
        ? "Total indisponível"
        : `Total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data!.total)}`;
  return (
    <Box sx={{ px: 2, pb: 1 }} aria-live="polite">
      <Text size={FontSizes.SMALL} weight={FontWeights.SEMI_BOLD}>
        {text}
      </Text>
    </Box>
  );
}
