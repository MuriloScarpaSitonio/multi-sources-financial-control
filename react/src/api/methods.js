import { privateAxios, publicAxios } from "./instances";

import { useQuery } from "../hooks/useQuery";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { AccessTokenStr, RefreshTokenStr } from "../consts";

const Query = (url) => useQuery(privateAxios, url);

const QueryWithInfiteScroll = (url) => useInfiniteScroll(privateAxios, url);

const get = (url) => privateAxios.get(url);

const post = async (url, data = {}) => privateAxios.post(url, data);

const patch = async (url, data) => privateAxios.patch(url, data);

const put = async (url, data) => privateAxios.put(url, data);

const Delete = async (url) => privateAxios.delete(url);

export const login = (data) => publicAxios.post("token", data);

const signup = (data) => publicAxios.post("users", data);

const activateUser = (uidb64, token) =>
  publicAxios.post(`auth/activate_user/${uidb64}`, { token });

const forgotPassword = (email) =>
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
  Query,
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
