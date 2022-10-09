import { DividerWithText } from "../components/DividerWithText";
import { TransactionsIndicators } from "../components/transactions/TransactionsIndicators";
import { TransactionsTable } from "../components/transactions/TransactionsTable";
import { TransactionsReports } from "../components/transactions/TransactionsReports";

export default function Transactions() {
  return (
    <>
      <TransactionsIndicators />
      <DividerWithText children="Transações" container />
      <TransactionsTable />
      <DividerWithText children="Relatórios" container />
      <TransactionsReports />
    </>
  );
}
