import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { apiProvider } from "../../../api/methods";
import { searchClient } from "../../../test/fullHistorySearch";
import FullHistorySearchTotal from "./FullHistorySearchTotal";

const response = (total: number) => ({
  data: { total },
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem("hideValues");
});
it.each(["expenses", "revenues"] as const)(
  "shows the server's filtered %s total",
  async (resource) => {
    vi.spyOn(apiProvider, "get").mockResolvedValue(response(12345.67));
    render(
      <QueryClientProvider client={searchClient()}>
        <FullHistorySearchTotal
          resource={resource}
          filters={{ description: "super" }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Calculando total…")).toBeInTheDocument();
    expect(
      await screen.findByText(/Total: R\$\s*12\.345,67/),
    ).toBeInTheDocument();
  },
);
it("does not display an old total after filters change", async () => {
  let finish: (value: ReturnType<typeof response>) => void = () => {};
  vi.spyOn(apiProvider, "get").mockImplementation(
    (_url: string, config: any) =>
      config.params.description === "old"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(response(50)),
  );
  const client = searchClient();
  const view = render(
    <QueryClientProvider client={client}>
      <FullHistorySearchTotal
        resource="expenses"
        filters={{ description: "old" }}
      />
    </QueryClientProvider>,
  );
  view.rerender(
    <QueryClientProvider client={client}>
      <FullHistorySearchTotal
        resource="expenses"
        filters={{ description: "new" }}
      />
    </QueryClientProvider>,
  );
  await screen.findByText(/Total: R\$\s*50,00/);
  await act(async () => {
    finish(response(900));
  });
  expect(screen.getByText(/Total: R\$\s*50,00/)).toBeInTheDocument();
  expect(screen.queryByText(/900,00/)).not.toBeInTheDocument();
});
it("shows unavailable feedback instead of zero when the total fails", async () => {
  vi.spyOn(apiProvider, "get").mockRejectedValue(new Error("Unavailable"));
  render(
    <QueryClientProvider client={searchClient()}>
      <FullHistorySearchTotal resource="expenses" filters={{}} />
    </QueryClientProvider>,
  );
  await screen.findByText("Total indisponível");
  expect(screen.queryByText(/Total: R\$/)).not.toBeInTheDocument();
});
it("respects the existing hide-values toggle", async () => {
  vi.spyOn(apiProvider, "get").mockResolvedValue(response(12345.67));
  render(
    <QueryClientProvider client={searchClient()}>
      <FullHistorySearchTotal resource="expenses" filters={{}} />
    </QueryClientProvider>,
  );
  await screen.findByText(/12\.345,67/);
  act(() => {
    localStorage.setItem("hideValues", "true");
    window.dispatchEvent(new Event("storage"));
  });
  expect(screen.getByText("Total: •••")).toBeInTheDocument();
  expect(screen.queryByText(/12\.345,67/)).not.toBeInTheDocument();
});
