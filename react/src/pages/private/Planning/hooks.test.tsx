import type { ReactNode } from "react";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { enqueueSnackbar } from "notistack";
import { updatePlanningPreferences } from "./api";
import { useUpdatePlanningPreferences } from "./hooks";
vi.mock("notistack", () => ({ enqueueSnackbar: vi.fn() }));
vi.mock("./api", () => ({
  updatePlanningPreferences: vi.fn(),
  getPlanningPreferences: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each([true, false])(
  "reports save success=%s through a toast",
  async (success) => {
    const mutation = vi.mocked(updatePlanningPreferences);
    if (success)
      mutation.mockResolvedValue({ fire: { simulated_patrimony: 2100000 } });
    else mutation.mockRejectedValue(new Error("Network error"));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useUpdatePlanningPreferences, { wrapper });
    act(() =>
      result.current.mutate({ fire: { simulated_patrimony: 2100000 } }),
    );
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        success
          ? "Alterações salvas."
          : "Não foi possível salvar as alterações. Tente novamente.",
        { variant: success ? "success" : "error" },
      ),
    );
    client.clear();
  },
);
