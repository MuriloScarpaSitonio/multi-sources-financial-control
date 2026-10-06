import { useFireSimulationWorker } from "./useFireSimulationWorker";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import VPWIndicator from "./VPWIndicator";
import { DEFAULT_VPW_PREFERENCES } from "../Planning/api";
vi.mock("./useFireSimulationWorker", () => ({
  useFireSimulationWorker: vi.fn(() => ({
    result: null,
    isCalculating: false,
    error: null,
  })),
}));
afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  vi.useRealTimers();
});
const props = {
  allocation: [
    { category: "FIXED_CDI" as const, series: "CDI" as const, total: 1000000 },
  ],
  preferences: DEFAULT_VPW_PREFERENCES,
  avgExpenses: 100,
  isLoading: false,
  dateOfBirth: "1986-01-01",
};
it("uses the capped initial withdrawal without claiming retirement safety", () => {
  render(<VPWIndicator {...props} />);
  expect(screen.getByText(/R\$ 100,00/)).toBeVisible();
  expect(screen.getByText(/100%/)).toBeVisible();
  expect(screen.queryByText(/Pode aposentar/i)).toBeNull();
});
it("requires a birth date and keeps an invalid target actionable", () => {
  const { rerender } = render(<VPWIndicator {...props} dateOfBirth={null} />);
  expect(screen.getByText(/data de nascimento/i)).toBeVisible();
  rerender(
    <VPWIndicator
      {...props}
      preferences={{ ...props.preferences, target_age: 20 }}
    />,
  );
  expect(screen.getByText(/idade alvo maior/i)).toBeVisible();
});
it("includes bank cash in the expense-capped withdrawal", () => {
  render(
    <VPWIndicator
      {...props}
      allocation={[{ category: "CASH", series: "CASH", total: 1000000 }]}
    />,
  );
  expect(screen.getByText(/R\$ 100,00/)).toBeVisible();
});

it("shows unavailable data instead of a zero-wealth scenario on query failure", () => {
  render(<VPWIndicator {...props} isError />);
  expect(screen.getByText(/carregar os dados/i)).toBeVisible();
  expect(screen.queryByText(/cobertura inicial/)).toBeNull();
});

it("keeps initial coverage available when saved accumulation requires future contributions", () => {
  render(
    <VPWIndicator
      {...props}
      avgExpenses={100000}
      preferences={{ ...props.preferences, extra_accumulation_years: 5 }}
    />,
  );
  expect(screen.getByText(/cobertura inicial/)).toBeVisible();
  expect(screen.queryByText(/aporte mensal positivo/)).toBeNull();
});

it("shows progress toward the simulated target in compact mode", () => {
  vi.mocked(useFireSimulationWorker).mockReturnValueOnce({
    result: { kind: "vpw", output: { targetPatrimony: 2000000 } },
    isCalculating: false,
    error: null,
  } as ReturnType<typeof useFireSimulationWorker>);
  render(<VPWIndicator {...props} compact hideLabel />);
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  expect(screen.getByText("50%")).toBeVisible();
  expect(screen.getByText("Meta: R$ 2.000.000,00")).toBeVisible();
  expect(screen.queryByText(/cobertura inicial/)).not.toBeInTheDocument();
});
it("waits for the simulated target in compact mode", () => {
  render(<VPWIndicator {...props} compact />);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByText(/Meta:/)).not.toBeInTheDocument();
});
