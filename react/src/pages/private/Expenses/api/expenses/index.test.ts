import { afterEach, expect, it, vi } from "vitest";
import { apiProvider } from "../../../../../api/methods";
import { getExpenses, getSum } from "./index";

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

it("sum accepts all-history filters with optional raw bounds and repeated selectors", async () => {
  const requests: URLSearchParams[] = [];
  vi.spyOn(apiProvider, "get").mockImplementation(
    async (url: string, config: any) => {
      expect(url).toBe("expenses/sum");
      requests.push(
        new URLSearchParams(config.paramsSerializer(config.params)),
      );
      return { data: { total: 20.2 } } as any;
    },
  );
  await getSum({
    description: "super",
    category: ["Casa", "Lazer"],
    source: ["Cash"],
    tag: ["red", "blue"],
    bank_account_description: "Nubank",
  });
  expect(requests[0].get("description")).toBe("super");
  expect(requests[0].getAll("category")).toEqual(["Casa", "Lazer"]);
  expect(requests[0].getAll("tag")).toEqual(["red", "blue"]);
  expect(requests[0].getAll("source")).toEqual(["Cash"]);
  expect(requests[0].get("bank_account_description")).toBe("Nubank");
  expect(requests[0].has("start_date")).toBe(false);
  expect(requests[0].has("end_date")).toBe(false);
  await getSum({ startDate: "01/01/2020", endDate: new Date(2030, 11, 31) });
  expect(requests[1].get("start_date")).toBe("01/01/2020");
  expect(requests[1].get("end_date")).toBe("31/12/2030");
});
