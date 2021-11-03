import { DividerWithText } from "../components/DividerWithText";
import { ExpensesProgress } from "../components/expenses/ExpensesProgress";
import { ExpensesReports } from "../components/expenses/ExpensesReports";
import { ExpensesTable } from "../components/expenses/ExpensesTable";

export default function Expenses() {
  return (
    <>
      <ExpensesProgress />
      <DividerWithText children="Histórico" container />
      <ExpensesTable />
      <DividerWithText children="Relatórios" container />
      <ExpensesReports />
    </>
  );
}
