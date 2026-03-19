import axios from "axios";
import { clearAccessToken, getAccessToken } from "./tokenStore";
import { BACKEND_ORIGIN } from "./base";

export const apiClient = axios.create({
  baseURL: BACKEND_ORIGIN || undefined,
  withCredentials: false,
  headers: {
    Accept: "application/json",
  },
});

export async function ensureStudentAccessToken() {
  return getAccessToken();
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
  async (error) => {
    if (error?.response?.status === 401) {
      clearAccessToken();
    }
    throw error;
  },
);