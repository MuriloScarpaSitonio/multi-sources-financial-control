import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import FireDatasetPills from "./FireDatasetPills";

afterEach(cleanup);

it("requires a choice for multiple subgroups and selects a sole index automatically", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <FireDatasetPills label="Históricos" value="IMA_S" onChange={onChange} />,
  );
  const sidebar = within(
    screen.getByRole("group", { name: "Tipos de históricos" }),
  );
  await user.click(sidebar.getByRole("button", { name: "Renda variável BR" }));
  expect(screen.getByRole("button", { name: "Ações" })).toBeVisible();
  expect(screen.getByRole("button", { name: "FII" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "IBOV" }),
  ).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "FII" }));
  expect(onChange).toHaveBeenLastCalledWith("IFIX");
  await user.click(sidebar.getByRole("button", { name: "Cripto" }));
  expect(
    screen.queryByRole("button", { name: "IFIX" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Bitcoin" }),
  ).not.toBeInTheDocument();
});

it("filters empty groups and subgroups along with unavailable datasets", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <FireDatasetPills
      label="Anterior"
      value=""
      datasets={["IBOV", "CDI"]}
      onChange={onChange}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Cripto" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Renda variável BR" }));
  expect(screen.queryByRole("button", { name: "FII" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ações" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith("IBOV");
});

it("auto-selects the sole subgroup but waits when multiple indices remain", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <FireDatasetPills
      label="Anterior"
      value=""
      datasets={["SPY", "VTI"]}
      onChange={onChange}
    />,
  );
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Renda variável EUA" }));
  expect(screen.getByRole("button", { name: "Ações" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(onChange).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "VTI · mercado americano" }),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith("VTI");
});

it("locks the primary subgroup while allowing its indices to change", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <FireDatasetPills
      label="Principal"
      value="VT"
      lockSubgroup
      onChange={onChange}
    />,
  );
  expect(
    screen.queryByRole("group", { name: "Tipos de históricos" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ações" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "IBOV" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "VWRL/VWRA · ações globais" }),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith("VWRL");
});

it("disables the primary index when its subgroup has only one option", () => {
  render(
    <FireDatasetPills
      label="Principal"
      value="IBOV"
      lockSubgroup
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "IBOV" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "IBOV" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
