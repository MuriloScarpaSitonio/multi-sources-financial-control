import { useQuery } from "@tanstack/react-query";

import * as api from "../api/patrimony";

const GROWTH_QUERY_KEY = "patrimony-growth";

export const usePatrimonyGrowth = (params: { months?: number; years?: number }) =>
  useQuery({
    queryKey: [GROWTH_QUERY_KEY, params.months, params.years],
    queryFn: () => api.getGrowth(params),
    enabled: !!(params.months || params.years),
  });

