import { DividerWithText } from "../components/DividerWithText";
import { PassiveIncomesIndicators } from "../components/passiveIncomes/PassiveIncomesIndicators";
import { PassiveIncomesReports } from "../components/passiveIncomes/PassiveIncomesReports";
import { PassiveIncomesTable } from "../components/passiveIncomes/PassiveIncomesTable";

export default function Transactions() {
  return (
    <>
      <PassiveIncomesIndicators />
      <DividerWithText children="Rendimentos passivos" container />
      <PassiveIncomesTable />
      <DividerWithText children="Relatórios" container />
      <PassiveIncomesReports />
    </>
  );
}
