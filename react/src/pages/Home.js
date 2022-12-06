import { DividerWithText } from "../components/DividerWithText";
import { AssetsIndicators } from "../components/assets/AssetsIndicators";
import { ExpensesIndicators } from "../components/expenses/ExpensesIndicators";
import { HomeReports } from "../components/home/HomeReports";

export default function Home() {
  return (
    <>
      <AssetsIndicators condensed />
      <ExpensesIndicators condensed />
      <DividerWithText children="Relatórios" container />
      <HomeReports />
    </>
  );
}
