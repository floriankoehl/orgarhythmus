import { BASE_URL } from "../../../config/api";

export const API = `${BASE_URL}/api`;

export function authFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
