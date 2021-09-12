import { privateAxios, publicAxios } from "./instances";

import { useQuery } from "../hooks/useQuery"
import { AccessTokenStr, RefreshTokenStr } from "../consts";

const Query = url => useQuery(privateAxios, url)

const post = async (url, data) => privateAxios.post(url, data)

const put = async (url, data) => privateAxios.put(url, data)

const Delete = async url => privateAxios.delete(url)

const login = data => publicAxios.post('token', data)

const refreshToken = async () => {
    let data = { "refresh": localStorage.getItem(RefreshTokenStr) }
    try {
        const response = await publicAxios.post('token/refresh', data);
        localStorage.setItem(AccessTokenStr, response.data.access);
        return await Promise.resolve(response.data);
    } catch (error) {
        return Promise.reject(error);
    }
}

export const apiProvider = { Query, login, post, put, Delete, refreshToken }
