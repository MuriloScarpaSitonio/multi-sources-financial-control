import { apiProvider } from "./methods";

class Api {
  constructor(methods, id = null) {
    if (methods.query) {
      this.query = (filters) =>
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

export class ExpenseApi extends Api {
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
  }
}

export class RevenueApi extends Api {
  resource = "revenues";
  constructor(id = null) {
    super({ query: false, post: true, patch: true, delete: true }, id);

    this.indicators = () => apiProvider.get(`${this.resource}/indicators`);
  }
}

export class AuthenticationApi {
  constructor() {
    this.login = (data) => apiProvider.login(data);
    this.refreshToken = () => apiProvider.refreshToken();
  }
}
