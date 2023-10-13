import { DividerWithText } from "../components/DividerWithText";
import { AssetsIndicators } from "../components/assets/AssetsIndicators";
import { ExpensesIndicators } from "../components/expenses/ExpensesIndicators";
import { HomeReports } from "../components/home/HomeReports";
import { stringToBoolean } from "../helpers.js";

export default function Home() {
  const isPersonalFinancesModuleEnabled = stringToBoolean(
    localStorage.getItem("user_is_personal_finances_module_enabled")
  );
  const isInvestmentsModuleEnabled = stringToBoolean(
    localStorage.getItem("user_is_investments_module_enabled")
  );
  return (
    <>
      {isInvestmentsModuleEnabled && <AssetsIndicators condensed />}
      {isPersonalFinancesModuleEnabled && <ExpensesIndicators condensed />}
      <DividerWithText children="Relatórios" container />
      <HomeReports
        isPersonalFinancesModuleEnabled={isPersonalFinancesModuleEnabled}
        isInvestmentsModuleEnabled={isInvestmentsModuleEnabled}
      />
    </>
  );
}
