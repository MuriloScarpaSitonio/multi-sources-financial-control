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
