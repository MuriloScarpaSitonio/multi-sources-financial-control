import { AxiosHeaders } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import { apiProvider } from "../../../api/methods";
import { getRevenues, getSum } from "./api";
afterEach(() => vi.restoreAllMocks());
it("keeps optional date bounds, raw URL strings and the existing bank filter", async () => {
  const get = vi.spyOn(apiProvider, "get").mockResolvedValue({
    data: { count: 0, results: [] },
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
  await getRevenues({
    page: 2,
    page_size: 100,
    bank_account_description: "Nubank",
  });
  const params = get.mock.calls[0][1].params;
  expect(params.start_date).toBeUndefined();
  expect(params.end_date).toBeUndefined();
  expect(params).toMatchObject({ page: 2, bank_account_description: "Nubank" });
  await getRevenues({
    startDate: "01/01/2020",
    endDate: new Date(2021, 0, 31),
  });
  expect(get.mock.calls[1][1].params).toMatchObject({
    start_date: "01/01/2020",
    end_date: "31/01/2021",
  });
});

it("sum accepts description and bank filters without forced date bounds", async () => {
  const get = vi
    .spyOn(apiProvider, "get")
    .mockResolvedValue({
      data: { total: 10 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
  await getSum({ description: "salary", bank_account_description: "Nubank" });
  expect(get.mock.calls[0][0]).toBe("revenues/sum");
  expect(get.mock.calls[0][1].params).toMatchObject({
    description: "salary",
    bank_account_description: "Nubank",
  });
  expect(get.mock.calls[0][1].params.start_date).toBeUndefined();
  expect(get.mock.calls[0][1].params.end_date).toBeUndefined();
  await getSum({ startDate: new Date(2020, 0, 1), endDate: "31/12/2030" });
  expect(get.mock.calls[1][1].params).toMatchObject({
    start_date: "01/01/2020",
    end_date: "31/12/2030",
  });
});
