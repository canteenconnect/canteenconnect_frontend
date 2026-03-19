import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { BACKEND_ORIGIN } from "./base";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "./tokenStore";

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: BACKEND_ORIGIN || undefined,
  withCredentials: false,
  headers: {
    Accept: "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshStudentSession(): Promise<string | null> {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    clearSessionTokens();
    return null;
  }

  const response = await fetch(`${BACKEND_ORIGIN}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ refresh_token: currentRefreshToken }),
  });

  if (!response.ok) {
    clearSessionTokens();
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };

  setSessionTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  });
  return payload.access_token;
}

export async function ensureStudentAccessToken() {
  const currentAccessToken = getAccessToken();
  if (currentAccessToken) {
    return currentAccessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshStudentSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await ensureStudentAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const requestUrl = String(config?.url || "");
    const isRefreshRequest = requestUrl.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !isRefreshRequest
    ) {
      config._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshStudentSession().finally(() => {
          refreshPromise = null;
        });
      }

      const nextAccessToken = await refreshPromise;
      if (nextAccessToken) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${nextAccessToken}`;
        return apiClient.request(config);
      }
    }

    if (error.response?.status === 401) {
      clearSessionTokens();
    }
    throw error;
  },
);
