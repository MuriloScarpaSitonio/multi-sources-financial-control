import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "../../../../../design-system";
import { createAsset, getAssetsMinimalData } from "../../../Assets/api";
import { AssetCurrencies } from "../../../Assets/consts";
import { createTransaction } from "../../api";
import NewTransactionForm from "./NewTransactionForm";

vi.mock("../../../Assets/api", () => ({
  createAsset: vi.fn(),
  getAssetsMinimalData: vi.fn(),
  updateAssetPrice: vi.fn(),
}));
vi.mock("../../api", () => ({ createTransaction: vi.fn() }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAssetsMinimalData).mockResolvedValue([]);
  vi.mocked(createAsset).mockResolvedValue({ id: 42 } as Awaited<
    ReturnType<typeof createAsset>
  >);
});

function renderForm() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ThemeProvider theme={theme}>
        <NewTransactionForm id="transaction-test" setIsSubmitting={() => {}} />
        <button type="submit" form="transaction-test">
          Submit
        </button>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function selectNewGlobalAsset(code: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("combobox", { name: /Ativo/ }), code);
  await user.click(
    await screen.findByRole("option", { name: `Adicionar "${code}"` }),
  );
  await user.click(screen.getByRole("combobox", { name: /Categoria/ }));
  await user.click(
    screen.getByRole("option", { name: "Renda variável Global" }),
  );
  await user.click(screen.getByRole("radio", { name: "Crescimento" }));
  fireEvent.change(screen.getByLabelText(/Preço/), {
    target: { value: "100" },
  });
  fireEvent.change(screen.getByLabelText(/Quantidade/), {
    target: { value: "10" },
  });
  return user;
}

describe("global asset currency", () => {
  it("creates a BRL global asset and transaction without a dollar conversion", async () => {
    renderForm();
    const user = await selectNewGlobalAsset("MUND11");
    await user.click(screen.getByRole("radio", { name: "Real" }));
    expect(screen.queryByLabelText(/Cotação do dólar/)).not.toBeInTheDocument();
    await user.click(screen.getByText("Submit"));
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "MUND11",
        type: "EQUITY_GLOBAL",
        currency: "BRL",
      }),
    );
    const transaction = vi.mocked(createTransaction).mock.calls[0][0];
    expect(transaction).toMatchObject({
      asset_pk: 42,
      quantity: 10,
      price: 100,
    });
    expect(transaction).not.toHaveProperty("current_currency_conversion_rate");
    expect(transaction).not.toHaveProperty("currency");
  });

  it("requires dollar conversion for a USD global asset", async () => {
    renderForm();
    const user = await selectNewGlobalAsset("VWRA");
    await user.click(screen.getByRole("radio", { name: "Dólar" }));
    await user.click(screen.getByText("Submit"));
    expect(
      await screen.findByText("Obrigatório para ativos em dólar"),
    ).toBeInTheDocument();
    expect(createAsset).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Cotação do dólar/), {
      target: { value: "5" },
    });
    await user.click(screen.getByText("Submit"));
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD" }),
    );
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_pk: 42,
        current_currency_conversion_rate: 5,
      }),
    );
  });

  it("uses the currency of an existing asset without offering a transaction currency", async () => {
    vi.mocked(getAssetsMinimalData).mockResolvedValue([
      {
        pk: 1,
        code: "MUND11",
        type: "EQUITY_GLOBAL",
        currency: AssetCurrencies.BRL,
        is_held_in_self_custody: false,
        quantity_balance: 10,
      },
    ]);
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Ativo/ }));
    await user.click(await screen.findByRole("option", { name: "MUND11" }));
    expect(
      screen.queryByRole("radio", { name: "Real" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cotação do dólar/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Preço/), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/Quantidade/), {
      target: { value: "10" },
    });
    await user.click(screen.getByText("Submit"));
    await waitFor(() => expect(createTransaction).toHaveBeenCalled());
    expect(createAsset).not.toHaveBeenCalled();
    expect(vi.mocked(createTransaction).mock.calls[0][0]).not.toHaveProperty(
      "currency",
    );
  });
});
