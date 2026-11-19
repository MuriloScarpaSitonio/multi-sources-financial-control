import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../../../../../design-system";
import { AssetCurrencies } from "../../consts";
import { editAsset } from "../../api";
import AssetsForm from "./index";

vi.mock("../../api", () => ({ editAsset: vi.fn(), deleteAsset: vi.fn() }));
afterEach(cleanup);

it("lets a global asset's currency be corrected at asset level", async () => {
  const user = userEvent.setup();
  const client = new QueryClient();
  client.setQueryData(
    ["assets-minimal-data"],
    [{ code: "MUND11", currency: "USD" }],
  );
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <AssetsForm
          asset={{
            write_model_pk: 42,
            code: "MUND11",
            description: "",
            type: "Renda variável Global",
            objective: "Crescimento",
            currency: AssetCurrencies.USD,
            quantity_balance: 0,
            current_price: 100,
            current_price_updated_at: "",
            adjusted_avg_price: 0,
            normalized_roi: 0,
            roi_percentage: 0,
            normalized_total_invested: 0,
            percentage_invested: 0,
            current_percentage: 0,
            is_held_in_self_custody: false,
            liquidity_type: null,
            maturity_date: null,
            indexer: null,
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("radio", { name: "Dólar" })).toBeChecked();
  await user.click(screen.getByRole("radio", { name: "Real" }));
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(editAsset).toHaveBeenCalledWith({
      id: 42,
      data: expect.objectContaining({ currency: "BRL", type: "EQUITY_GLOBAL" }),
    }),
  );
  await waitFor(() =>
    expect(client.getQueryState(["assets-minimal-data"])?.isInvalidated).toBe(
      true,
    ),
  );
});
