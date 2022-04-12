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

let fastApiRevenuesAxios = axios.create({
  baseURL: "http://127.0.0.1:5000",
  timeout: 5000,
  headers: getAuthHeaders(),
});

const logout = () => {
  window.localStorage.removeItem(AccessTokenStr);
  window.localStorage.removeItem(RefreshTokenStr);
  privateAxios.defaults.headers = {};
};

privateAxios.interceptors.response.use(
  (response) => {
    //console.log('privateAxios =', response.data)
    return response;
  },
  (error) => {
    const {
      config,
      response: { status },
    } = error;
    const originalRequest = config;
    if (status === 401) {
      apiProvider
        .refreshToken()
        .then(() => {
          let headers = getAuthHeaders();
          privateAxios.defaults.headers = headers;
          originalRequest.headers = headers;
          return privateAxios(originalRequest);
        })
        .catch((err) => {
          logout();
          return Promise.reject(err);
        });
    }
    return Promise.reject(error);
  }
);

export { privateAxios, publicAxios, fastApiRevenuesAxios };
