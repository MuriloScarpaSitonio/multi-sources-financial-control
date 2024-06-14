import { useQuery } from "@tanstack/react-query";

import { getRoiReport } from "../../../../../api/assets";

export const useRoiReport = (params: { opened: boolean; closed: boolean }) =>
  useQuery({
    queryKey: ["assets-reports-roi", params],
    queryFn: () => getRoiReport(params),
  });
