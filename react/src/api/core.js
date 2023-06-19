import { apiProvider } from "./methods";

class Api {
  constructor(methods, id = null) {
    if (methods.query) {
      this.query = (filters = "") =>
        apiProvider.Query(`${this.resource}?${filters}`);
    }
    if (methods.get) {
      this.get = () => apiProvider.get(`${this.resource}/${id}`);
    }
    if (methods.post) {
      this.post = (data) => apiProvider.post(this.resource, data);
    }
    if (methods.put) {
      this.put = (data) => apiProvider.put(`${this.resource}/${id}`, data);
    }
    if (methods.patch) {
      this.patch = (data) => apiProvider.patch(`${this.resource}/${id}`, data);
    }
    if (methods.delete) {
      this.delete = () => apiProvider.Delete(`${this.resource}/${id}`);
    }
  }
}

export class ExpensesApi extends Api {
  resource = "expenses";
  constructor(id = null) {
    super(
      {
        query: true,
        get: false,
        post: true,
        put: true,
        patch: false,
        delete: true,
      },
      id
    );

    this.report = (type_of_report, filters) => {
      return apiProvider.get(
        `${this.resource}/report?of=${type_of_report}&${new URLSearchParams(
          filters
        ).toString()}`
      );
    };

    this.historic = (filters) =>
      apiProvider.get(
        `${this.resource}/historic?${new URLSearchParams(filters).toString()}`
      );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);

    this.list = (filters = "") =>
      apiProvider.get(`${this.resource}?${filters}`);

    this.bulkCreateFixed = () =>
      apiProvider.post(`${this.resource}/fixed_from_last_month`);

    this.cnpj = () => apiProvider.get(`${this.resource}/cnpj`);
  }
}

export class RevenuesApi extends Api {
  resource = "gateway/revenues";
  constructor(id = null) {
    super(
      {
        query: true,
        get: false,
        post: true,
        put: false,
        patch: true,
        delete: true,
      },
      id
    );

    this.indicators = () =>
      apiProvider.get(`${this.resource}/reports/indicators`);
    this.historic = () => apiProvider.get(`${this.resource}/reports/historic`);
    this.salaries = () =>
      apiProvider.get(`${this.resource}?description=Salário&size=13`);
  }
}

export class AuthenticationApi {
  constructor() {
    this.login = (data) => apiProvider.login(data);
    this.refreshToken = () => apiProvider.refreshToken();
  }
}

export class UserApi extends Api {
  resource = "users";
  constructor(id = null) {
    super(
      {
        query: false,
        get: true,
        post: true,
        put: false,
        patch: true,
        delete: false,
      },
      id
    );
  }
}
export class AssetsApi extends Api {
  resource = "assets";
  constructor(code = null) {
    super(
      {
        query: true,
        get: false,
        post: true,
        put: true,
        patch: false,
        delete: true,
      },
      code
    );
    this.simulateTransaction = (code, data) =>
      apiProvider.post(`${this.resource}/${code}/transactions/simulate`, data);

    this.getCodesAndCurrencies = () =>
      apiProvider.get(`${this.resource}/codes_and_currencies`);
    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.totalInvestedReport = (filters = {}) =>
      apiProvider.get(
        `${this.resource}/total_invested_report?${new URLSearchParams(
          filters
        ).toString()}`
      );
    this.roiReport = (filters = {}) =>
      apiProvider.get(
        `${this.resource}/roi_report?${new URLSearchParams(filters).toString()}`
      );
    this.syncAll = () => apiProvider.get(`${this.resource}/sync_all`);
    this.syncCeiTransactions = () =>
      apiProvider.get(`${this.resource}/sync_cei_transactions`);
    this.syncCeiPassiveIncomes = () =>
      apiProvider.get(`${this.resource}/sync_cei_passive_incomes`);
    this.syncKuCoinTransactions = () =>
      apiProvider.get(`${this.resource}/sync_kucoin_transactions`);
    this.syncBinanceTransactions = () =>
      apiProvider.get(`${this.resource}/sync_binance_transactions`);
    this.syncPrices = () =>
      apiProvider.get(`${this.resource}/integrations/update_prices`);
  }
}

export class PassiveIncomesApi extends Api {
  resource = "incomes";
  constructor(id = null) {
    super(
      {
        query: true,
        get: false,
        post: true,
        put: true,
        patch: true,
        delete: true,
      },
      id
    );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.historic = () => apiProvider.get(`${this.resource}/historic`);
    this.assetsAggregationReport = (filters) =>
      apiProvider.get(
        `${this.resource}/assets_aggregation_report?${new URLSearchParams(
          filters
        ).toString()}`
      );
  }
}

export class TasksApi extends Api {
  resource = "tasks";
  constructor(id = null) {
    super(
      {
        query: false,
        get: false,
        post: false,
        put: false,
        patch: false,
        delete: false,
      },
      id
    );

    this.infiniteScroll = (filters = "") =>
      apiProvider.QueryWithInfiteScroll(`${this.resource}?${filters}`);
    this.count = (filters) =>
      apiProvider.get(
        `${this.resource}/count?${new URLSearchParams(filters).toString()}`
      );
    this.bulkUpdateNotifiedAt = (ids) =>
      apiProvider.post(`${this.resource}/bulk_update_notified_at`, { ids });
  }
}

export class TransactionsApi extends Api {
  resource = "transactions";
  constructor(id = null) {
    super(
      {
        query: true,
        get: false,
        post: true,
        put: true,
        patch: true,
        delete: true,
      },
      id
    );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.historic = () => apiProvider.get(`${this.resource}/historic`);
  }
}
