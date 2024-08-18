import { apiProvider } from "./methods";

class Api {
  constructor(methods, id = null) {
    if (methods.query) {
      this.query = (filters = "") =>
        apiProvider.Query(`${this.resource}?${filters}`);
    }
    if (methods.retrieve) {
      this.retrieve = () => apiProvider.get(`${this.resource}/${id}`);
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

class _PersonalFinancesApi extends Api {
  constructor(id = null) {
    super(
      {
        query: true,
        retrieve: false,
        post: true,
        put: true,
        patch: false,
        delete: true,
      },
      id,
    );

    this.historic = (filters) =>
      apiProvider.get(
        `${this.resource}/historic?${new URLSearchParams(filters).toString()}`,
      );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
  }
}

export class ExpensesApi extends _PersonalFinancesApi {
  resource = "expenses";
  constructor(id = null) {
    super(id);

    this.report = (kind, filters) => {
      return apiProvider.get(
        `${this.resource}/avg_comparasion_report?group_by=${kind}&${new URLSearchParams(
          filters,
        ).toString()}`,
      );
    };
  }
}

export class RevenuesApi extends _PersonalFinancesApi {
  resource = "revenues";
}

export class AuthenticationApi {
  constructor() {
    this.login = (data) => apiProvider.login(data);
    this.signup = (data) => apiProvider.signup(data);
    this.activateUser = (uidb64, token) =>
      apiProvider.activateUser(uidb64, token);
    this.forgotPassword = (email) => apiProvider.forgotPassword(email);
    this.resetPassword = (uidb64, data) =>
      apiProvider.resetPassword(uidb64, data);
    this.refreshToken = () => apiProvider.refreshToken();
  }
}

export class UserApi extends Api {
  resource = "users";
  constructor(id = null) {
    super(
      {
        query: false,
        retrieve: true,
        post: false,
        put: false,
        patch: true,
        delete: false,
      },
      id,
    );
    this.changePassword = (data) =>
      apiProvider.patch(`${this.resource}/change_password`, data);
  }
}
export class SubscriptionApi extends Api {
  resource = "subscription";
  constructor(id = null) {
    super(
      {
        query: false,
        retrieve: false,
        post: false,
        put: false,
        patch: false,
        delete: false,
      },
      id,
    );
    this.createPortalSession = () =>
      apiProvider.post(`${this.resource}/portal_session`);
    this.createCheckoutSession = (price_id) =>
      apiProvider.post(`${this.resource}/checkout_session`, { price_id });
    this.getProducts = () => apiProvider.get(`${this.resource}/products`);
  }
}
export class AssetsApi extends Api {
  resource = "assets";
  constructor(id = null) {
    super(
      {
        query: true,
        retrieve: false,
        post: true,
        put: true,
        patch: false,
        delete: true,
      },
      id,
    );

    this.getMinimalData = () =>
      apiProvider.get(`${this.resource}/minimal_data`);
    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.totalInvestedReport = (filters = {}) =>
      apiProvider.get(
        `${this.resource}/total_invested_report?${new URLSearchParams(
          filters,
        ).toString()}`,
      );
    this.roiReport = (filters = {}) =>
      apiProvider.get(
        `${this.resource}/roi_report?${new URLSearchParams(filters).toString()}`,
      );
    this.syncAll = () => apiProvider.get(`${this.resource}/sync_all`);
  }
}

export class PassiveIncomesApi extends Api {
  resource = "incomes";
  constructor(id = null) {
    super(
      {
        query: true,
        retrieve: false,
        post: true,
        put: true,
        patch: true,
        delete: true,
      },
      id,
    );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.historic = () => apiProvider.get(`${this.resource}/historic`);
    this.assetsAggregationReport = (filters) =>
      apiProvider.get(
        `${this.resource}/assets_aggregation_report?${new URLSearchParams(
          filters,
        ).toString()}`,
      );
  }
}

export class TasksApi extends Api {
  resource = "tasks";
  constructor(id = null) {
    super(
      {
        query: false,
        retrieve: false,
        post: false,
        put: false,
        patch: false,
        delete: false,
      },
      id,
    );

    this.infiniteScroll = (filters = "") =>
      apiProvider.QueryWithInfiteScroll(`${this.resource}?${filters}`);
    this.count = (filters) =>
      apiProvider.get(
        `${this.resource}/count?${new URLSearchParams(filters).toString()}`,
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
        retrieve: false,
        post: true,
        put: true,
        patch: true,
        delete: true,
      },
      id,
    );

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
    this.historic = () => apiProvider.get(`${this.resource}/historic`);
  }
}

export class AssetTransactionsApi extends Api {
  constructor(id = null) {
    super(
      {
        query: true,
        retrieve: false,
        post: false,
        put: false,
        patch: false,
        delete: false,
      },
      id,
    );
    this.resource = `assets/${id}/transactions`;

    this.simulate = (data) =>
      apiProvider.post(`${this.resource}/simulate`, data);
  }
}

export class AssetIncomessApi extends Api {
  constructor(id = null) {
    super(
      {
        query: true,
        retrieve: false,
        post: false,
        put: false,
        patch: false,
        delete: false,
      },
      id,
    );

    this.resource = `assets/${id}/incomes`;
  }
}
