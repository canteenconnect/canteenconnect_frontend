import type { Request, Response } from "express";

const DEFAULT_BACKEND_URL = "https://canteenconnect-backend.onrender.com";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

type RequestWithRawBody = Request & { rawBody?: unknown };

function resolveBackendUrl() {
  const configured =
    process.env.BACKEND_API_URL ||
    process.env.VITE_BACKEND_URL ||
    DEFAULT_BACKEND_URL;
  return configured.replace(/\/+$/, "");
}

function resolveApiPath(req: Request, pathOverride?: string) {
  const incomingPath = pathOverride ?? req.originalUrl ?? req.url ?? "/api/health";
  if (incomingPath.startsWith("/api")) {
    return incomingPath;
  }
  return `/api${incomingPath.startsWith("/") ? incomingPath : `/${incomingPath}`}`;
}

function buildForwardHeaders(req: Request) {
  const headers = new Headers();
  for (const [headerName, headerValue] of Object.entries(req.headers)) {
    const lower = headerName.toLowerCase();
    if (!headerValue || HOP_BY_HOP_HEADERS.has(lower) || lower === "content-length") {
      continue;
    }

    if (Array.isArray(headerValue)) {
      for (const value of headerValue) {
        headers.append(headerName, value);
      }
    } else {
      headers.set(headerName, headerValue);
    }
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    headers.set("x-forwarded-for", `${forwardedFor}, ${req.ip ?? "127.0.0.1"}`);
  } else {
    headers.set("x-forwarded-for", req.ip ?? "127.0.0.1");
  }

  const forwardedHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (typeof forwardedHost === "string") {
    headers.set("x-forwarded-host", forwardedHost);
  }
  headers.set("x-forwarded-proto", req.protocol);

  return headers;
}

function methodAcceptsBody(method: string) {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD";
}

function buildUrlEncodedBody(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

function buildForwardBody(req: RequestWithRawBody) {
  if (!methodAcceptsBody(req.method)) return undefined;

  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }

  if (typeof req.rawBody === "string") {
    return req.rawBody;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return buildUrlEncodedBody(req.body);
  }

  if (contentType.includes("application/json") && req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }

  if (req.readable) {
    return req;
  }

  return undefined;
}

function copyResponseHeaders(upstreamHeaders: Headers, res: Response) {
  upstreamHeaders.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    res.setHeader(key, value);
  });

  const headerObject = upstreamHeaders as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof headerObject.getSetCookie === "function") {
    const cookies = headerObject.getSetCookie();
    if (cookies.length > 0) {
      res.setHeader("Set-Cookie", cookies);
    }
    return;
  }

  if (typeof headerObject.raw === "function") {
    const rawHeaders = headerObject.raw();
    if (Array.isArray(rawHeaders["set-cookie"]) && rawHeaders["set-cookie"].length > 0) {
      res.setHeader("Set-Cookie", rawHeaders["set-cookie"]);
      return;
    }
  }

  const singleCookie = upstreamHeaders.get("set-cookie");
  if (singleCookie) {
    res.setHeader("Set-Cookie", singleCookie);
  }
}

export async function proxyApiRequest(
  req: RequestWithRawBody,
  res: Response,
  pathOverride?: string,
) {
  const backendUrl = resolveBackendUrl();
  const apiPath = resolveApiPath(req, pathOverride);
  const targetUrl = new URL(apiPath, `${backendUrl}/`);

  const headers = buildForwardHeaders(req);
  const body = buildForwardBody(req);

  const requestInit: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (body !== undefined && methodAcceptsBody(req.method)) {
    requestInit.body = body as BodyInit;
    if (typeof (body as unknown as { pipe?: unknown }).pipe === "function") {
      requestInit.duplex = "half";
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, requestInit);
    copyResponseHeaders(upstreamResponse.headers, res);
    res.status(upstreamResponse.status);

    const payload = Buffer.from(await upstreamResponse.arrayBuffer());
    return res.send(payload);
  } catch {
    return res.status(502).json({
      success: false,
      message: "Upstream backend is unavailable",
      code: "UPSTREAM_UNAVAILABLE",
      details: {
        backendUrl,
      },
    });
  }
}
