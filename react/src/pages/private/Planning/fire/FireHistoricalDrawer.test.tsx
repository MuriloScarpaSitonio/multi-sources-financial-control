import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_FIRE_PREFERENCES } from "../api";
import { buildPortfolio } from "../../Home/firePortfolio";
import { historicalSummary } from "./fireHistoricalDatasets";
import FireHistoricalDrawer from "./FireHistoricalDrawer";

const allocation = [
  {
    category: "FIXED_SELIC",
    series: "IMA_S",
    total: 150000,
    assets: [
      { id: 1, code: "LFT", description: "Tesouro Selic 2029", total: 150000 },
    ],
  },
  {
    category: "FIXED_CDI",
    series: "CDI",
    total: 50000,
    assets: [{ id: 2, code: "CDB", description: "CDB Banco", total: 50000 }],
  },
] as const;
afterEach(cleanup);

it("changes the historical dataset without changing category or weight", () => {
  const portfolio = buildPortfolio(allocation, {
    ...DEFAULT_FIRE_PREFERENCES,
    historical_series_overrides: { "FIXED_SELIC:IMA_S": "CDI" },
  });
  expect(portfolio[0]).toEqual({
    category: "FIXED_SELIC",
    series: "CDI",
    weight: 0.75,
    constrainsSample: true,
  });
});

it("previews history and affected assets, cancels locally, and applies only on request", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();
  const { unmount } = render(
    <FireHistoricalDrawer
      allocation={allocation}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  expect(screen.queryByText("Cripto")).not.toBeInTheDocument();
  expect(screen.getByText(/Limitado por: IMA-S/)).toBeVisible();
  await user.click(
    screen.getAllByRole("button", { name: "1 ativo afetado" })[0],
  );
  expect(screen.getByText("Tesouro Selic 2029")).toBeVisible();
  await user.click(
    screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
  );
  await user.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: /CDI/ }),
  );
  expect(screen.getByText(/Limitado por: CDI/)).toBeVisible();
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onApply).not.toHaveBeenCalled();
  unmount();
  render(
    <FireHistoricalDrawer
      allocation={allocation}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  expect(
    screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
  ).toHaveTextContent("IMA-S");
  await user.click(
    screen.getByRole("combobox", { name: "Histórico para Renda fixa Selic" }),
  );
  await user.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: /CDI/ }),
  );
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({ "FIXED_SELIC:IMA_S": "CDI" }),
    {},
  );
});

it("includes fallback history for age-in-bonds", () => {
  const equities = [
    { category: "BR_EQUITY", series: "IBOV", total: 1000 },
  ] as const;
  const base = historicalSummary(equities, DEFAULT_FIRE_PREFERENCES);
  const ageInBonds = historicalSummary(
    equities,
    DEFAULT_FIRE_PREFERENCES,
    true,
  );
  expect(base.period.first).toBe("1995-01");
  expect(ageInBonds.additional).toEqual(["IMA_GERAL_EX_C"]);
  expect(ageInBonds.period.first).toBe("2005-04");
  expect(ageInBonds.limiting).toContain("IMA_GERAL_EX_C");
});

it("keeps separate maturity buckets and overrides legacy exclusions explicitly", () => {
  const buckets = [
    { category: "FIXED_IPCA", series: "IMA_B_5", total: 100 },
    { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 300 },
  ] as const;
  const portfolio = buildPortfolio(buckets, {
    ...DEFAULT_FIRE_PREFERENCES,
    excluded_return_categories: ["FIXED_IPCA"],
    historical_series_overrides: { "FIXED_IPCA:IMA_B_5": "CDI" },
  });
  expect(portfolio).toEqual([
    {
      category: "FIXED_IPCA",
      series: "CDI",
      weight: 0.25,
      constrainsSample: true,
    },
    {
      category: "FIXED_IPCA",
      series: "CASH",
      weight: 0.75,
      constrainsSample: false,
    },
  ]);
});

it("orders buckets by descending portfolio share and shows asset code before description", async () => {
  const user = userEvent.setup();
  render(
    <FireHistoricalDrawer
      allocation={[allocation[1], allocation[0]]}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen
      .getAllByRole("combobox")
      .map((element) => element.getAttribute("aria-label")),
  ).toEqual([
    "Histórico para Renda fixa Selic",
    "Histórico para Renda fixa CDI",
  ]);
  await user.click(
    screen.getAllByRole("button", { name: "1 ativo afetado" })[0],
  );
  expect(
    screen
      .getByText("LFT")
      .compareDocumentPosition(screen.getByText("Tesouro Selic 2029")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("flags an unusual dataset without blocking it, and clears the warning for a matching dataset", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(
    <FireHistoricalDrawer
      allocation={[
        { category: "CRYPTO", series: null, total: 1000, assets: [] },
      ]}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={onApply}
      onClose={vi.fn()}
    />,
  );
  expect(screen.queryByText(/Escolha atípica/)).not.toBeInTheDocument();
  const select = screen.getByRole("combobox", {
    name: "Histórico para Cripto",
  });
  await user.click(select);
  await user.click(screen.getByRole("option", { name: /^IMA-S/ }));
  expect(
    screen.getByText(/Escolha atípica: IMA-S representa renda fixa/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenCalledWith({ "CRYPTO:default": "IMA_S" }, {});
  await user.click(select);
  await user.click(screen.getByRole("option", { name: /^CMBI 10/ }));
  expect(screen.queryByText(/Escolha atípica/)).not.toBeInTheDocument();
});

it("groups historical options and skips group headings during keyboard selection", async () => {
  const user = userEvent.setup();
  render(
    <FireHistoricalDrawer
      allocation={[{ category: "BR_EQUITY", series: "IBOV", total: 1000 }]}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const select = screen.getByRole("combobox", {
    name: "Histórico para Renda variável BR",
  });
  await user.click(select);
  const menu = within(screen.getByRole("listbox"));
  for (const label of [
    "Ações brasileiras",
    "Ações americanas",
    "Ações globais",
    "Fundos imobiliários",
    "Cripto",
    "Renda fixa",
    "Dinheiro",
  ]) {
    expect(menu.getByText(label)).toBeVisible();
  }
  await user.keyboard("{ArrowDown}{Enter}");
  expect(select).toHaveTextContent("SPY · S&P 500");
});

it("drafts an earlier dataset, previews its contribution, and applies or removes it explicitly", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(
    <FireHistoricalDrawer
      allocation={allocation}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={onApply}
      onClose={vi.fn()}
    />,
  );
  await user.click(
    screen.getAllByRole("button", {
      name: "Complementar histórico anterior",
    })[0],
  );
  await user.click(
    screen.getByRole("combobox", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  );
  await user.click(screen.getByRole("option", { name: /^CDI ·/ }));
  expect(screen.getByText(/complementado · .*principal/)).toBeVisible();
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenLastCalledWith({}, { "FIXED_SELIC:IMA_S": "CDI" });
  await user.click(
    screen.getByRole("button", {
      name: "Remover histórico anterior para Renda fixa Selic",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenLastCalledWith({}, {});
});
