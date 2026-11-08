import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import * as assetsApi from "../api";
import type { Asset } from "../api/models";
import { AssetCurrencies } from "../consts";
import Table from "./index";
import SimulatedTransactionTable from "./TopToolbar/SimulateTransactionMenuItem/SimulatedTransactionTable";

const chtr: Asset = {
  write_model_pk: 236,
  code: "CHTR",
  description: "",
  type: "Renda variável EUA",
  objective: "Crescimento",
  currency: AssetCurrencies.USD,
  quantity_balance: 38.468,
  current_price: 118.029999,
  current_price_updated_at: "2026-11-08T14:02:05Z",
  adjusted_avg_price: 1406.0502443589478,
  normalized_roi: -30000,
  roi_percentage: -55,
  normalized_total_invested: 54075,
  percentage_invested: 10,
  current_percentage: 10,
  is_held_in_self_custody: false,
  liquidity_type: null,
  maturity_date: null,
  indexer: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("labels CHTR's BRL-adjusted average in reais while keeping its market price in dollars", async () => {
  vi.spyOn(assetsApi, "getAssets").mockResolvedValue({
    count: 1,
    results: [chtr],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Table
          externalFilters={{
            filters: { type: [], sector: [], objective: [], status: "OPENED" },
            setFilters: () => {},
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/R\$\s*1\.406,0502/)).toBeInTheDocument();
  expect(screen.getByText(/US\$\s*118,03/)).toBeInTheDocument();
  expect(screen.queryByText(/US\$\s*1\.406/)).not.toBeInTheDocument();
  client.clear();
});

it("labels both simulated adjusted averages in reais for a dollar asset", () => {
  const simulation = {
    ...chtr,
    adjusted_avg_price: chtr.adjusted_avg_price,
    roi: -30000,
    roi_percentage: -55,
    normalized_total_invested: 54075,
  };
  render(
    <SimulatedTransactionTable
      simulatedAsset={{
        old: simulation,
        new: { ...simulation, adjusted_avg_price: 1300 },
      }}
    />,
  );
  expect(screen.getByText(/R\$\s*1\.406,0502/)).toBeInTheDocument();
  expect(screen.getByText(/R\$\s*1\.300,00/)).toBeInTheDocument();
  expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
});
