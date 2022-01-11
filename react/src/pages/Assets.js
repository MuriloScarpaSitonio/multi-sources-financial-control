import { DividerWithText } from "../components/DividerWithText";
import { AssetsIndicators } from "../components/assets/AssetsIndicators";
import { AssetsTable } from "../components/assets/AssetsTable";
import { AssetsReports } from "../components/assets/AssetsReports";

export default function Assets() {
  return (
    <>
      <AssetsIndicators />
      <DividerWithText children="Ativos abertos" container />
      <AssetsTable />
      <DividerWithText children="Relatórios" container />
      <AssetsReports />
    </>
  );
}
