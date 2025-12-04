// frontend/src/auth.js
import { BASE_URL } from "./config/api";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// ---- LOGIN: call Django SimpleJWT endpoint ----
export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/jwt/create/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    // Try to parse error details, otherwise generic
    let errorMessage = "Login failed";
    try {
      const data = await res.json();
      if (data.detail) {
        errorMessage = data.detail;
      }
    } catch (e) {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();

  // Store the tokens so they survive page reloads
  localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
}

// ---- LOGOUT: remove tokens from storage ----
export function logout() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ---- Helper: get current access token ----
export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// ---- authFetch: like fetch(), but with Authorization header when logged in ----
export async function authFetch(path, options = {}) {
  const token = getAccessToken();

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If body is a JS object and no content-type set yet, assume JSON
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return res;
}






//HELPER I ADDED MANUALLY
export function hasToken() {
  return !!getAccessToken();
}