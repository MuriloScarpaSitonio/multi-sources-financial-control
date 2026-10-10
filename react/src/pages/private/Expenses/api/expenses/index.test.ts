import { afterEach, expect, it, vi } from "vitest";
import { apiProvider } from "../../../../../api/methods";
import { getExpenses } from "./index";

afterEach(() => vi.restoreAllMocks());
it("serializes optional raw/legacy dates and repeated entity filters on the existing endpoint", async () => {
  const calls: { url: string; params: URLSearchParams }[] = [];
  vi.spyOn(apiProvider, "get").mockImplementation(
    async (url: string, config: any) => {
      calls.push({
        url,
        params: new URLSearchParams(config.paramsSerializer(config.params)),
      });
      return { data: { count: 0, results: [] } } as any;
    },
  );
  await getExpenses({
    description: "super",
    category: ["Casa", "Lazer"],
    bank_account_description: "Nubank",
  });
  expect(calls[0].url).toBe("expenses");
  expect(calls[0].params.has("start_date")).toBe(false);
  expect(calls[0].params.has("end_date")).toBe(false);
  expect(calls[0].params.getAll("category")).toEqual(["Casa", "Lazer"]);
  expect(calls[0].params.get("bank_account_description")).toBe("Nubank");
  await getExpenses({ startDate: "01/01/2020" });
  expect(calls[1].params.get("start_date")).toBe("01/01/2020");
  expect(calls[1].params.has("end_date")).toBe(false);
  await getExpenses({ endDate: new Date(2030, 11, 31) });
  expect(calls[2].params.get("end_date")).toBe("31/12/2030");
  expect(calls[2].params.has("start_date")).toBe(false);
});
