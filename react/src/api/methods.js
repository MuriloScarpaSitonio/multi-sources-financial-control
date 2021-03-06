import { privateAxios, publicAxios } from "./instances";

import { useQuery } from "../hooks/useQuery";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { AccessTokenStr, RefreshTokenStr } from "../consts";

const Query = (url) => useQuery(privateAxios, url);

const QueryWithInfiteScroll = (url) => useInfiniteScroll(privateAxios, url);

const get = (url) => privateAxios.get(url);

const post = async (url, data) => privateAxios.post(url, data);

const patch = async (url, data) => privateAxios.patch(url, data);

const put = async (url, data) => privateAxios.put(url, data);

const Delete = async (url) => privateAxios.delete(url);

const login = (data) => publicAxios.post("token", data);

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
  post,
  patch,
  put,
  Delete,
  refreshToken,
  get,
};
