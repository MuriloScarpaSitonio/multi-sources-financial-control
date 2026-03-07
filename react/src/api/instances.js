import axios from "axios";
import createAuthRefresh from "axios-auth-refresh";

import { apiProvider } from "./methods";

import { AccessTokenStr, BaseApiUrl, RefreshTokenStr } from "../consts";

let publicAxios = axios.create({
  baseURL: BaseApiUrl,
  timeout: 5000,
});

const getAuthHeaders = () => {
  let accessToken = localStorage.getItem(AccessTokenStr);
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
};

let privateAxios = axios.create({
  baseURL: BaseApiUrl,
  timeout: 5000,
  headers: getAuthHeaders(),
});

const logout = () => {
  localStorage.removeItem(AccessTokenStr);
  localStorage.removeItem(RefreshTokenStr);
  localStorage.removeItem("user_subscription_status");
  privateAxios.defaults.headers = {};
};

const refreshAuthLogic = (failedRequest) =>
  apiProvider
    .refreshToken()
    .then(() => {
      const headers = getAuthHeaders();
      privateAxios.defaults.headers = headers;
      failedRequest.response.config.headers = headers;
    })
    .catch((err) => {
      logout();
      return Promise.reject(err);
    });

createAuthRefresh(privateAxios, refreshAuthLogic);

export { logout, privateAxios, publicAxios };
