// Auth API calls. One function per backend endpoint. Each owns its own
// request/response shape and side effects on token storage.

import { httpClient } from "./httpClient";
import { clearTokens, getRefreshToken, setTokens } from "./tokenStorage";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<void> {
  const { data } = await httpClient.post<TokenPair>("/auth/login", { email, password });
  setTokens(data.accessToken, data.refreshToken);
}

export async function register(email: string, password: string, name: string): Promise<void> {
  await httpClient.post("/auth/register", { email, password, name });
}

export async function refresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("no_refresh_token");
  const { data } = await httpClient.post<TokenPair>("/auth/refresh", { refreshToken });
  setTokens(data.accessToken, data.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await httpClient.post("/auth/logout", { refreshToken });
  }
  clearTokens();
}
