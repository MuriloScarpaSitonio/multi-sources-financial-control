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

it("uses portfolio tabs and locks the primary subgroup", async () => {
  const user = userEvent.setup();
  render(
    <FireHistoricalDrawer
      allocation={allocation}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Renda fixa",
  ]);
  await user.click(
    screen.getByRole("button", {
      name: "O que significa complementar histórico anterior?",
    }),
  );
  expect(
    screen.getByText(/um complemento pode acrescentar meses de janeiro/),
  ).toBeVisible();
  const primary = within(
    screen.getByRole("group", { name: "Histórico para Renda fixa Selic" }),
  );
  expect(primary.getByRole("button", { name: "Pós-fixada" })).toBeDisabled();
  expect(primary.getByRole("button", { name: "IMA-S" })).toBeEnabled();
  expect(primary.getByRole("button", { name: "IMA-S" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  await user.click(
    within(
      screen.getByRole("group", { name: "Subgrupos da carteira" }),
    ).getByRole("button", { name: "CDI" }),
  );
  expect(
    screen.queryByRole("button", { name: "Complementar histórico anterior" }),
  ).not.toBeInTheDocument();
});

it("expands only valid complement choices, drafts on index selection, and supports change/removal", async () => {
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
  expect(
    screen.queryByRole("group", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Complementar histórico anterior" }),
  );
  let earlier = within(
    screen.getByRole("group", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  );
  expect(
    earlier.queryByRole("button", { name: "Cripto" }),
  ).not.toBeInTheDocument();
  await user.click(earlier.getByRole("button", { name: "Renda fixa" }));
  expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  await user.click(earlier.getByRole("button", { name: "Pós-fixada" }));
  expect(
    screen.queryByRole("group", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("CDI · 01/1995–04/2004")).toBeVisible();
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenCalledWith({}, { "FIXED_SELIC:IMA_S": "CDI" });
  await user.click(
    screen.getByRole("button", {
      name: "Alterar histórico anterior para Renda fixa Selic",
    }),
  );
  earlier = within(
    screen.getByRole("group", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  );
  await user.click(earlier.getByRole("button", { name: "Renda variável BR" }));
  expect(screen.getByText("IBOV · 01/1995–04/2004")).toBeVisible();
  await user.click(
    screen.getByRole("button", {
      name: "Remover histórico anterior para Renda fixa Selic",
    }),
  );
  expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
});

it("preserves saved primary overrides and allows removing an ineligible complement", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  render(
    <FireHistoricalDrawer
      allocation={allocation}
      preferences={{
        ...DEFAULT_FIRE_PREFERENCES,
        historical_series_overrides: { "FIXED_SELIC:IMA_S": "IBOV" },
        historical_series_fallbacks: { "FIXED_SELIC:IMA_S": "CDI" },
      }}
      onApply={onApply}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Complementar histórico anterior" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "IBOV" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", {
      name: "Remover histórico anterior para Renda fixa Selic",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Aplicar" }));
  expect(onApply).toHaveBeenCalledWith({ "FIXED_SELIC:IMA_S": "IBOV" }, {});
});

it("keeps drafts across tabs but discards them on cancellation", async () => {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();
  const props = {
    allocation,
    preferences: DEFAULT_FIRE_PREFERENCES,
    onApply,
    onClose,
  };
  const page = render(<FireHistoricalDrawer {...props} />);
  await user.click(
    screen.getByRole("button", { name: "Complementar histórico anterior" }),
  );
  const earlier = within(
    screen.getByRole("group", {
      name: "Histórico anterior para Renda fixa Selic",
    }),
  );
  await user.click(earlier.getByRole("button", { name: "Renda fixa" }));
  await user.click(earlier.getByRole("button", { name: "Pós-fixada" }));
  await user.click(
    within(
      screen.getByRole("group", { name: "Subgrupos da carteira" }),
    ).getByRole("button", { name: "CDI" }),
  );
  await user.click(
    within(
      screen.getByRole("group", { name: "Subgrupos da carteira" }),
    ).getByRole("button", { name: "Selic" }),
  );
  expect(screen.getByText("CDI · 01/1995–04/2004")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "1 ativo afetado" }));
  expect(
    screen
      .getByText("LFT")
      .compareDocumentPosition(screen.getByText("Tesouro Selic 2029")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalled();
  expect(onApply).not.toHaveBeenCalled();
  page.unmount();
  render(<FireHistoricalDrawer {...props} />);
  expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  expect(screen.queryByText("CDI · 01/1995–04/2004")).not.toBeInTheDocument();
});

it("groups portfolio subgroups under broad sidebar asset types", async () => {
  const user = userEvent.setup();
  render(
    <FireHistoricalDrawer
      allocation={[
        ...allocation,
        { category: "BR_EQUITY", series: "IBOV", total: 400000 },
        { category: "FII", series: "IFIX", total: 100000 },
        { category: "FIXED_IPCA", series: "IMA_B_5_PLUS", total: 90000 },
      ]}
      preferences={DEFAULT_FIRE_PREFERENCES}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Renda variável BR",
    "Renda fixa",
  ]);
  const subgroups = within(
    screen.getByRole("group", { name: "Subgrupos da carteira" }),
  );
  expect(subgroups.getByRole("button", { name: "Ações" })).toBeVisible();
  await user.click(subgroups.getByRole("button", { name: "FII" }));
  expect(
    screen.getByRole("group", { name: "Histórico para FII" }),
  ).toBeVisible();
  screen.getByRole("tab", { name: "Renda variável BR" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("tab", { name: "Renda fixa" })).toHaveFocus();
  expect(
    within(
      screen.getByRole("group", { name: "Subgrupos da carteira" }),
    ).getByRole("button", { name: /IPCA/ }),
  ).toBeVisible();
});
