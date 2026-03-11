import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@shared/routes";
import { clearAccessToken, getAccessToken, setAccessToken } from "./tokenStore";
import { BACKEND_ORIGIN, withApiOrigin } from "./base";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: BACKEND_ORIGIN || undefined,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshStudentAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post(withApiOrigin(api.auth.refresh.path), null, {
      withCredentials: true,
      headers: {
        Accept: "application/json",
      },
    });

    const parsed = api.auth.refresh.responses[200].safeParse(response.data);
    if (!parsed.success) {
      clearAccessToken();
      return null;
    }

    const nextToken = parsed.data.data.accessToken;
    setAccessToken(nextToken);
    return nextToken;
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function ensureStudentAccessToken() {
  const existingToken = getAccessToken();
  if (existingToken) {
    return existingToken;
  }

  try {
    const response = await axios.get(withApiOrigin(api.auth.studentToken.path), {
      withCredentials: true,
      headers: {
        Accept: "application/json",
      },
    });

    const parsed = api.auth.studentToken.responses[200].safeParse(response.data);
    if (!parsed.success) {
      return null;
    }

    const token = parsed.data.data.accessToken;
    setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    if (!originalRequest || originalRequest._retry) {
      throw error;
    }

    const responseStatus = error.response?.status;
    const responseCode = (error.response?.data as { code?: string } | undefined)?.code;
    const requestUrl = originalRequest.url ?? "";
    const isRefreshRequest = requestUrl.includes(api.auth.refresh.path);
    const shouldAttemptRefresh =
      responseStatus === 401 &&
      !isRefreshRequest &&
      ["TOKEN_EXPIRED", "TOKEN_INVALID", "AUTH_TOKEN_MISSING"].includes(
        responseCode ?? "",
      );

    if (!shouldAttemptRefresh) {
      throw error;
    }

    if (!refreshInFlight) {
      refreshInFlight = refreshStudentAccessToken().finally(() => {
        refreshInFlight = null;
      });
    }

    const nextToken = await refreshInFlight;
    if (!nextToken) {
      throw error;
    }

    originalRequest._retry = true;
    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${nextToken}`;
    return apiClient(originalRequest);
  },
);
