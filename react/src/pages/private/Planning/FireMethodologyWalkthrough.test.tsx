import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FireMethodologyWalkthrough from "./FireMethodologyWalkthrough";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows loading and disables redraw until the complete round is ready", async () => {
  vi.useFakeTimers();
  render(<FireMethodologyWalkthrough />);
  fireEvent.click(screen.getByText("1000 aposentados ao mesmo tempo"));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  fireEvent.click(screen.getByRole("button", { name: "Sortear nova rodada" }));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Calculando simulação")).toBeInTheDocument();
  expect(screen.queryByText(/sobreviveram à taxa/)).not.toBeInTheDocument();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeEnabled();
  expect(
    screen.queryByLabelText("Calculando simulação"),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/sobreviveram à taxa/)).toBeInTheDocument();
});

it("cancels pending calculation when leaving the step", () => {
  vi.useFakeTimers();
  render(<FireMethodologyWalkthrough />);
  fireEvent.click(screen.getByText("1000 aposentados ao mesmo tempo"));
  expect(
    screen.getByRole("button", { name: "Sortear nova rodada" }),
  ).toBeDisabled();
  cleanup();
  expect(vi.getTimerCount()).toBe(0);
});
