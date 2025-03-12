import { privateAxios, publicAxios } from "./instances";

import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { AccessTokenStr, RefreshTokenStr } from "../consts";

const QueryWithInfiteScroll = (url) => useInfiniteScroll(privateAxios, url);

const get = (url, config) => privateAxios.get(url, config);

const post = async (url, data = {}, config) =>
  privateAxios.post(url, data, config);

const patch = async (url, data, config) =>
  privateAxios.patch(url, data, config);

const put = async (url, data, config) => privateAxios.put(url, data, config);

const Delete = async (url, config) => privateAxios.delete(url, config);

export const login = (data) => publicAxios.post("token", data);

export const signup = (data) => publicAxios.post("users", data);

const activateUser = (uidb64, token) =>
  publicAxios.post(`auth/activate_user/${uidb64}`, { token });

export const forgotPassword = (email) =>
  publicAxios.post("auth/forgot_password", { email });

const resetPassword = (uidb64, data) =>
  publicAxios.post(`auth/reset_password/${uidb64}`, data);
const refreshToken = async () => {
  let data = { refresh: localStorage.getItem(RefreshTokenStr) };
  try {
    const response = await publicAxios.post("token/refresh", data);
    localStorage.setItem(AccessTokenStr, response.data.access);
    return await Promise.resolve(response.data);
  } catch (error) {
    return Promise.reject(error);
  }
};

export const apiProvider = {
  QueryWithInfiteScroll,
  login,
  signup,
  forgotPassword,
  resetPassword,
  activateUser,
  post,
  patch,
  put,
  Delete,
  refreshToken,
  get,
};
