import { apiProvider } from "./methods";

class Api {
  constructor(methods, id = null) {
    if (methods.query) {
      this.query = (filters = "") =>
        apiProvider.Query(`${this.resource}?${filters}`);
    }
    if (methods.post) {
      this.post = (data) => apiProvider.post(this.resource, data);
    }
    if (methods.patch) {
      this.put = (data) => apiProvider.put(`${this.resource}/${id}`, data);
    }
    if (methods.delete) {
      this.delete = () => apiProvider.Delete(`${this.resource}/${id}`);
    }
  }
}

export class ExpensesApi extends Api {
  resource = "expenses";
  constructor(id = null) {
    super({ query: true, post: true, patch: true, delete: true }, id);

    this.report = (type_of_report, filters) => {
      let _filters = new URLSearchParams(filters);
      return apiProvider.get(
        `${this.resource}/report?of=${type_of_report}&${_filters.toString()}`
      );
    };

    this.historic = () => apiProvider.get(`${this.resource}/historic`);

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);

    this.list = (filters = "") =>
      apiProvider.get(`${this.resource}?${filters}`);

    this.bulkCreateFixed = () =>
      apiProvider.post(`${this.resource}/fixed_from_last_month`);
  }
}

export class RevenuesApi extends Api {
  resource = "revenues";
  constructor(id = null) {
    super({ query: false, post: true, patch: true, delete: true }, id);

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
  }
}

export class FastApiRevenue {
  constructor(id = null) {
    this.indicators = () => apiProvider.getRevenues("indicators/");
    this.list = () => apiProvider.getRevenues("revenues");
    this.delete = (id) => apiProvider.deleteRevenue(`revenues/${id}`);
    this.historic = () => apiProvider.getRevenues("historic");
    this.post = (data) => apiProvider.postRevenues("revenues", data);
    this.patch = (data) => apiProvider.patch(`revenues/${id}`, data);
  }
}

export class AuthenticationApi {
  constructor() {
    this.login = (data) => apiProvider.login(data);
    this.refreshToken = () => apiProvider.refreshToken();
  }
}

export class AssetsApi extends Api {
  resource = "assets";
  constructor() {
    super({ query: true, post: false, patch: false, delete: false });

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.report = (filters = {}) =>
      apiProvider.get(
        `${this.resource}/report?${new URLSearchParams(filters).toString()}`
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
      apiProvider.get(`${this.resource}/fetch_current_prices`);
  }
}

export class IncomesApi extends Api {
  resource = "incomes";
  constructor(id = null) {
    super({ query: true, post: true, patch: true, delete: true }, id);

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
  }
}

export class TasksApi extends Api {
  resource = "tasks";
  constructor(id = null) {
    super({ query: false, post: false, patch: false, delete: false }, id);

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
