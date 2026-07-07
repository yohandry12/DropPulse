// Shared axios instance. Base URL "/api" hits the Vite dev proxy → Express backend.
// Request interceptor attaches the access token; response interceptor refreshes
// it once on 401 and replays the failed request.

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

export const httpClient = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Refresh-on-401 -------------------------------------------------------
// A single in-flight refresh shared across concurrent 401s, so N failing
// requests trigger one refresh (rotating token → parallel refreshes would race
// and invalidate each other).
let refreshInflight: Promise<string> | null = null;

// Refresh via a BARE axios call (not httpClient) so it can't recurse through
// this interceptor. Returns the new access token or throws.
async function runRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("no_refresh_token");
  const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
    "/api/auth/refresh",
    { refreshToken },
  );
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

function refreshAccessToken(): Promise<string> {
  if (!refreshInflight) {
    refreshInflight = runRefresh().finally(() => {
      refreshInflight = null;
    });
  }
  return refreshInflight;
}

// Retried requests carry a flag so a second 401 doesn't loop.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

httpClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetriableConfig | undefined;

    // Only handle a 401 we haven't already retried. The refresh endpoint itself
    // 401ing means the refresh token is dead → give up.
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (err.response?.status !== 401 || !original || original._retried || isRefreshCall) {
      return Promise.reject(err);
    }

    original._retried = true;
    try {
      const newToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${newToken}`;
      return httpClient(original);
    } catch {
      // Refresh failed: session is truly dead. Clear tokens and bounce to login.
      clearTokens();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
      return Promise.reject(err);
    }
  },
);

// Normalize backend error payloads ({ error: "code" }) into a stable code string.
export function apiErrorCode(err: unknown): string {
  if (err instanceof AxiosError) {
    const code = err.response?.data?.error;
    if (typeof code === "string") return code;
    if (!err.response) return "network_error";
  }
  return "unknown_error";
}
