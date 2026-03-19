const ACCESS_TOKEN_KEY = "canteen_access_token";
const REFRESH_TOKEN_KEY = "canteen_refresh_token";

let accessToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
let refreshToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function setSessionTokens(payload: {
  accessToken: string | null;
  refreshToken: string | null;
}) {
  setAccessToken(payload.accessToken);
  setRefreshToken(payload.refreshToken);
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function clearSessionTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}
