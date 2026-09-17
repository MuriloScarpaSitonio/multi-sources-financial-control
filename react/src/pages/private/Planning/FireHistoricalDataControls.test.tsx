import { fireEvent, render, screen } from "@testing-library/react";
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
