import { DividerWithText } from "../components/DividerWithText";
import { AssetsIndicators } from "../components/assets/AssetsIndicators";
import { AssetsTable } from "../components/assets/AssetsTable";

export default function Assets() {
  return (
    <>
      <AssetsIndicators />
      <DividerWithText children="Ativos" container />
      <AssetsTable />
    </>
  );
}
