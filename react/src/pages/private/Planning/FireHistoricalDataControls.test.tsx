import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { expect, test, vi } from "vitest";

import { FIRE_RETURN_SERIES } from "../Home/fireReturns";
import { DEFAULT_FIRE_PREFERENCES } from "./api";
import FireHistoricalDataControls from "./FireHistoricalDataControls";

const allocation = [
  { category: "BR_EQUITY", series: "IBOV", total: 900_000 },
  { category: "GLOBAL_EQUITY", series: null, total: 99_000 },
  { category: "CRYPTO", series: null, total: 1_000 },
  { category: "CASH", series: "CASH", total: 50_000 },
] as const;

test("renders owned categories and updates proxy/exclusion controls", () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onChange={onChange}
    />,
  );

  expect(screen.getByText("Renda variável BR")).toBeInTheDocument();
  expect(screen.getByDisplayValue("VT")).toBeInTheDocument();
  const initialPeriod = screen.getByText(/Período resultante:/).textContent;
  const expectedFirstYear = Math.max(
    ...["IBOV", "VT", "BTC"].map((key) =>
      Number(
        FIRE_RETURN_SERIES[key as "IBOV" | "VT" | "BTC"].months[0].slice(0, 4),
      ),
    ),
  );
  expect(initialPeriod).toContain(String(expectedFirstYear));
  expect(screen.queryByText("Caixa")).not.toBeInTheDocument();
  expect(screen.queryByText("Renda variável EUA")).not.toBeInTheDocument();

  const globalSelect = screen.getAllByRole("combobox")[0];
  fireEvent.mouseDown(globalSelect);
  fireEvent.click(screen.getByText(/VWRL\/VWRA/));
  expect(onChange).toHaveBeenCalledWith("global_equity_proxy", "VWRL");

  rerender(
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={{ ...DEFAULT_FIRE_PREFERENCES, global_equity_proxy: "VWRL" }}
      onChange={onChange}
    />,
  );
  expect(screen.getByText(/Período resultante:/).textContent).not.toBe(
    initialPeriod,
  );

  fireEvent.click(screen.getByLabelText("Cripto"));
  expect(onChange).toHaveBeenCalledWith("excluded_return_categories", [
    "CRYPTO",
  ]);

  rerender(
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={{
        ...DEFAULT_FIRE_PREFERENCES,
        crypto_proxy: "CMBI10",
      }}
      onChange={onChange}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "O período histórico é curto",
  );

  rerender(
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={{
        ...DEFAULT_FIRE_PREFERENCES,
        excluded_return_categories: ["CRYPTO"],
      }}
      onChange={onChange}
    />,
  );
  expect(screen.getByText(/Período resultante:/)).toHaveTextContent("2008");
  expect(allocation.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(
    1_050_000,
  );
});

test("distinguishes short- and long-duration fixed-income proxies", () => {
  render(
    <FireHistoricalDataControls
      allocation={[
        { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 100_000 },
        { category: "FIXED_IPCA", series: "IMA_B_5", total: 50_000 },
        {
          category: "FIXED_PREFIXED",
          series: "IRF_M_1_PLUS",
          total: 100_000,
        },
        { category: "FIXED_PREFIXED", series: "IRF_M_1", total: 50_000 },
      ]}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onChange={vi.fn()}
    />,
  );

  expect(
    screen.getByText("IMA-B 5 (até 5 anos) e IMA-B 5+ (acima de 5 anos)"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("IRF-M 1 (até 1 ano) e IRF-M 1+ (acima de 1 ano)"),
  ).toBeInTheDocument();
});

test("lets the studio own the warning and focus the historical controls", () => {
  const controlsRef = createRef<HTMLDivElement>();

  const { container } = render(
    <FireHistoricalDataControls
      allocation={allocation}
      preferences={{
        ...DEFAULT_FIRE_PREFERENCES,
        crypto_proxy: "CMBI10",
      }}
      onChange={vi.fn()}
      showShortPeriodWarning={false}
      controlsRef={controlsRef}
    />,
  );

  expect(within(container).queryByRole("alert")).not.toBeInTheDocument();
  expect(
    within(container).getByText(/Período resultante:/),
  ).toBeInTheDocument();
  controlsRef.current?.focus();
  expect(controlsRef.current).toHaveFocus();
});
