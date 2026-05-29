import { Navigate, useParams } from "react-router-dom";

import { type ActiveMethodKey } from "./api";
import DividendsOnlyDetail from "./strategies/DividendsOnlyDetail";
import FireDetail from "./strategies/FireDetail";
import OneOverNDetail from "./strategies/OneOverNDetail";
import VPWDetail from "./strategies/VPWDetail";
import { STRATEGY_CONTENT } from "./strategyContent";

const VALID_METHODS = Object.keys(STRATEGY_CONTENT) as ActiveMethodKey[];

const StrategyDetailPage = () => {
  const { method } = useParams<{ method: string }>();

  if (!method || !VALID_METHODS.includes(method as ActiveMethodKey)) {
    return <Navigate to="/planning" />;
  }

  switch (method as ActiveMethodKey) {
    case "fire":
      return <FireDetail />;
    case "dividends_only":
      return <DividendsOnlyDetail />;
    case "one_over_n":
      return <OneOverNDetail />;
    case "vpw":
      return <VPWDetail />;
  }
};

export default StrategyDetailPage;
