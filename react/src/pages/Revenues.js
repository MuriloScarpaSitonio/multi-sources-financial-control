import { DividerWithText } from "../components/DividerWithText";
import { RevenuesIndicators } from "../components/revenues/RevenuesIndicators";
import { RevenuesReports } from "../components/revenues/RevenuesReports";
import { RevenuesTable } from "../components/revenues/RevenuesTable";

export default function Revenues() {
  return (
    <>
      <RevenuesIndicators />
      <DividerWithText children="Histórico" container />
      <RevenuesTable />
      <DividerWithText children="Relatórios" container />
      <RevenuesReports />
    </>
  );
}
