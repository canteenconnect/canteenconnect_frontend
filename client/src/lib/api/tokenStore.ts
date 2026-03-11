const STORAGE_KEY = "canteen_access_token";
let accessToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAccessToken() {
  accessToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
