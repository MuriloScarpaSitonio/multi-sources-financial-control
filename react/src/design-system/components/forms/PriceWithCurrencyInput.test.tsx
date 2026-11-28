import { StrictMode } from "react";
import Drawer from "@mui/material/Drawer";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, expect, it, vi } from "vitest";

import PriceWithCurrencyInput from "./PriceWithCurrencyInput";

afterEach(cleanup);

function AmountForm({ initial = "", onSave = vi.fn() }) {
  const { control, handleSubmit } = useForm<FieldValues>({
    defaultValues: { value: initial },
  });
  return (
    <form onSubmit={handleSubmit((data) => onSave(data.value))}>
      <PriceWithCurrencyInput
        control={control}
        name="value"
        label="Valor"
        currencySymbol="R$"
        withCalculator
        isFieldInvalid={() => false}
        getFieldHasError={() => false}
        getErrorMessage={() => ""}
      />
      <button type="submit">Salvar</button>
    </form>
  );
}

it("applies keypad arithmetic to the amount and leaves submission to the form", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<AmountForm onSave={onSave} />);
  const amount = screen.getByRole("textbox", { name: /Valor/ });
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  for (const key of ["2", ",", "5", "+", "3", "×", "2"]) {
    await user.click(screen.getByRole("button", { name: key }));
  }
  expect(amount).toHaveValue("R$ 8,5");
  expect(onSave).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(8.5));
});

it("keeps the last valid amount during an incomplete calculation and clears it with Limpar", async () => {
  const user = userEvent.setup();
  render(<AmountForm initial="10.50" />);
  const amount = screen.getByRole("textbox", { name: /Valor/ });
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  const expression = screen.getByRole("textbox", { name: "Cálculo" });
  expect(expression).toHaveValue("10,5");
  await user.keyboard("/0");
  expect(amount).toHaveValue("R$ 10,50");
  await user.keyboard("{Backspace}3");
  expect(amount).toHaveValue("R$ 3,5");
  await user.click(screen.getByRole("button", { name: "Limpar" }));
  expect(expression).toHaveValue("");
  expect(amount).toHaveValue("");
});

it("accepts a pasted Brazilian amount and spaces around the operator", async () => {
  const user = userEvent.setup();
  render(<AmountForm />);
  const amount = screen.getByRole("textbox", { name: /Valor/ });
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  await user.click(screen.getByRole("textbox", { name: "Cálculo" }));
  await user.paste("1.234,56\t+ 0,45");
  expect(amount).toHaveValue("R$ 1.235,01");
});

it("accepts keyboard input immediately after opening the calculator in a drawer", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(
    <StrictMode>
      <Drawer open>
        <AmountForm onSave={onSave} />
      </Drawer>
    </StrictMode>,
  );
  const amount = screen.getByRole("textbox", { name: /Valor/ });
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  expect(screen.getByRole("textbox", { name: "Cálculo" })).toHaveFocus();
  await user.keyboard("12.50+3");
  expect(amount).toHaveValue("R$ 15,5");
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(onSave).not.toHaveBeenCalled();
});

it("updates after backspacing and closes with equals", async () => {
  const user = userEvent.setup();
  render(
    <Drawer open>
      <AmountForm />
    </Drawer>,
  );
  const amount = screen.getByRole("textbox", { name: /Valor/ });
  await user.click(screen.getByRole("button", { name: "Abrir calculadora" }));
  await user.click(screen.getByRole("button", { name: "2" }));
  expect(screen.getByRole("textbox", { name: "Cálculo" })).toHaveFocus();
  await user.keyboard("*35{Backspace}");
  expect(amount).toHaveValue("R$ 6");
  await user.keyboard("=");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
