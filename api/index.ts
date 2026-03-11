import express, { type Request, type Response } from "express";
import { proxyApiRequest } from "../server/upstreamProxy.js";

const app = express();
app.disable("x-powered-by");

const allowedOrigins = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,https://canteen-admin.vercel.app,https://canteen-admin-portal.vercel.app,https://canteen-student.vercel.app,https://canteen-student-portal.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginPatterns = (process.env.CORS_ORIGIN_PATTERNS ??
  "^https://canteen-admin(?:-[a-z0-9-]+)?\\.vercel\\.app$,^https://canteen-admin-portal(?:-[a-z0-9-]+)?\\.vercel\\.app$,^https://canteen-student(?:-[a-z0-9-]+)?\\.vercel\\.app$,^https://canteen-student-portal(?:-[a-z0-9-]+)?\\.vercel\\.app$")
  .split(",")
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return null;
    }
  })
  .filter((pattern): pattern is RegExp => pattern !== null);

function isAllowedOrigin(requestOrigin: string | undefined) {
  if (!requestOrigin) return false;
  if (allowedOrigins.includes(requestOrigin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(requestOrigin));
}

function applyCors(requestOrigin: string | undefined, res: Response) {
  if (!isAllowedOrigin(requestOrigin)) return;
  const origin = requestOrigin as string;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
}

function applySecurityHeaders(res: Response) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req: Request & { rawBody?: unknown }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, res, next) => {
  applySecurityHeaders(res);
  applyCors(req.headers.origin, res);
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/api/index", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Proxy function healthy",
    data: { status: "ok" },
  });
});

app.use((req, res) => {
  const originalPath = req.originalUrl || req.url;
  const apiPath = originalPath.startsWith("/api/index")
    ? originalPath.replace("/api/index", "/api")
    : originalPath;
  void proxyApiRequest(req as Request & { rawBody?: unknown }, res, apiPath);
});

export default async function handler(req: Request, res: Response) {
  return app(req, res);
}
