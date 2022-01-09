import { DividerWithText } from "../components/DividerWithText";
import { ExpensesIndicators } from "../components/expenses/ExpensesIndicators";
import { ExpensesReports } from "../components/expenses/ExpensesReports";
import { ExpensesTable } from "../components/expenses/ExpensesTable";

export default function Expenses() {
  return (
    <>
      <ExpensesIndicators />
      <DividerWithText children="Histórico" container />
      <ExpensesTable />
      <DividerWithText children="Relatórios" container />
      <ExpensesReports />
    </>
  );
}
