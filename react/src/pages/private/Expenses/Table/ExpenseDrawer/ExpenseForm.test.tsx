import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SnackbarProvider } from "notistack";
import { createExpense, editExpense } from "../../api/expenses";
import type { Expense } from "../../api/models";
import { EXPENSES_QUERY_KEY } from "../../consts";
import { ExpensesContext } from "../../context";
import ExpenseForm from "./ExpenseForm";

vi.mock("../../api/expenses", () => ({
  createExpense: vi.fn().mockResolvedValue({}),
  editExpense: vi.fn().mockResolvedValue({}),
  getTags: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../api/bank_account", () => ({
  list: vi
    .fn()
    .mockResolvedValue({
      results: [{ description: "Nubank", is_default: true }],
    }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const expense: Expense = {
  id: 1,
  description: "Purchase",
  value: 100,
  installments: 5,
  category: "Casa",
  source: "Cartão de crédito",
  created_at: "2026-05-15",
  is_fixed: false,
  full_description: "Purchase (1/5)",
  tags: [],
  bank_account_description: "Nubank",
};

function renderForm(initialData?: Expense) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData([EXPENSES_QUERY_KEY], { results: [expense] });
  client.setQueryData(["bank-accounts-summary"], { total: 10000 });
  client.setQueryData(["bank-accounts"], {
    results: [{ description: "Nubank", is_default: true }],
  });
  const onEditSuccess = vi.fn();
  const related = (name: string) => ({
    results: [{ id: 1, name, hex_color: "#ffffff" }],
    hexColorMapping: new Map([[name, "#ffffff"]]),
  });
  render(
    <QueryClientProvider client={client}>
      <SnackbarProvider>
        <ExpensesContext.Provider
          value={{
            startDate: new Date(),
            setStartDate: vi.fn(),
            endDate: new Date(),
            setEndDate: vi.fn(),
            month: undefined,
            setMonth: vi.fn(),
            year: 2026,
            setYear: vi.fn(),
            categories: related("Casa"),
            sources: related("Cartão de crédito"),
            revenuesCategories: related("Salário"),
            isRelatedEntitiesLoading: false,
            mostCommonCategory: { id: 1, name: "Casa", hex_color: "#ffffff" },
            mostCommonSource: undefined,
            mostCommonRevenueCategory: undefined,
          }}
        >
          <ExpenseForm
            id="test-expense"
            initialData={initialData}
            setIsSubmitting={vi.fn()}
            onEditSuccess={onEditSuccess}
          />
          <button type="submit" form="test-expense">
            Save
          </button>
        </ExpensesContext.Provider>
      </SnackbarProvider>
    </QueryClientProvider>,
  );
  return { client, onEditSuccess };
}

it("edits the count at the existing installment amount and invalidates the table and balances", async () => {
  const { client, onEditSuccess } = renderForm(expense);
  expect(screen.getByRole("spinbutton", { name: "Parcelas" })).toHaveValue(5);
  const user = userEvent.setup();
  await user.clear(screen.getByRole("spinbutton", { name: "Parcelas" }));
  await user.type(screen.getByRole("spinbutton", { name: "Parcelas" }), "3");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(editExpense).toHaveBeenCalled());
  await waitFor(() => expect(onEditSuccess).toHaveBeenCalledOnce());
  expect(editExpense).toHaveBeenCalledWith({
    id: 1,
    data: expect.objectContaining({ installments: 3, value: 100 }),
  });
  expect(client.getQueryState([EXPENSES_QUERY_KEY])?.isInvalidated).toBe(true);
  expect(client.getQueryState(["bank-accounts-summary"])?.isInvalidated).toBe(
    true,
  );
  expect(
    screen.queryByText(/Coloque o valor completo/),
  ).not.toBeInTheDocument();
});

it("continues creating expenses from the total purchase amount", async () => {
  renderForm();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Parcelas" }), {
    target: { value: "3" },
  });
  expect(screen.getByText(/Coloque o valor completo/)).toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "Descrição" }),
    "New purchase",
  );
  await user.type(screen.getByRole("textbox", { name: "Valor" }), "300");
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Conta bancária" }),
    ).toHaveValue("Nubank"),
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ installments: 3, value: 300 }),
    ),
  );
});
