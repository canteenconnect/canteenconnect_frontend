import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { withApiOrigin } from "@/lib/api/base";
import { getAccessToken } from "@/lib/api/tokenStore";

declare global {
  interface Window {
    __canteenFetchPatched?: boolean;
  }
}

if (!window.__canteenFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const token = getAccessToken();
    const withAuth = (requestInit?: RequestInit) => {
      if (!token) return requestInit;
      const headers = new Headers(requestInit?.headers ?? {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return { ...requestInit, headers };
    };

    if (typeof input === "string") {
      const normalized = input.startsWith("/api") ? withApiOrigin(input) : input;
      return originalFetch(normalized, withAuth(init));
    }

    if (input instanceof URL) {
      const value = input.toString();
      const normalized = value.includes("/api/") ? withApiOrigin(input.pathname + input.search) : value;
      return originalFetch(normalized, withAuth(init));
    }

    if (input instanceof Request) {
      const url = new URL(input.url, window.location.origin);
      const sameOriginApi = url.origin === window.location.origin && url.pathname.startsWith("/api");
      if (!sameOriginApi) {
        return originalFetch(input, init);
      }
      const headers = new Headers(input.headers);
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const nextRequest = new Request(withApiOrigin(url.pathname + url.search), {
        method: input.method,
        headers,
        body: input.method === "GET" || input.method === "HEAD" ? undefined : input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        integrity: input.integrity,
        keepalive: input.keepalive,
        signal: input.signal,
      });
      return originalFetch(nextRequest);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
  window.__canteenFetchPatched = true;
}

createRoot(document.getElementById("root")!).render(<App />);
