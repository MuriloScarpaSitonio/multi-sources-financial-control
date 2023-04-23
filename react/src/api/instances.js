import axios from "axios";

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
  window.localStorage.removeItem(AccessTokenStr);
  window.localStorage.removeItem(RefreshTokenStr);
  privateAxios.defaults.headers = {};
};

privateAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    const originalRequest = config;
    if (response?.status === 401) {
      return apiProvider
        .refreshToken()
        .then(() => {
          let headers = getAuthHeaders();
          privateAxios.defaults.headers = headers;
          originalRequest.headers = headers;
          if (["put", "patch", "post"].includes(originalRequest.method)) {
            originalRequest.data = JSON.parse(originalRequest.data);
          }
          return privateAxios(originalRequest).then((response) => response);
        })
        .catch((err) => {
          logout();
          return Promise.reject(err);
        });
    }
    return Promise.reject(error);
  }
);

export { privateAxios, publicAxios, logout };
