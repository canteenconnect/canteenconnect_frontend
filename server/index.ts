import express, { type Request, type Response } from "express";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import { proxyApiRequest } from "./upstreamProxy.js";

const app = express();
const httpServer = createServer(app);
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

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
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
app.use(cookieParser());
app.use((req, res, next) => {
  applySecurityHeaders(res);
  applyCors(req.headers.origin, res);
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Proxy server healthy",
    data: {
      status: "ok",
      backendUrl:
        process.env.BACKEND_API_URL ||
        process.env.VITE_BACKEND_URL ||
        "https://canteenconnect-backend.onrender.com",
    },
  });
});

app.use("/api", (req, res) => {
  void proxyApiRequest(req as Request & { rawBody?: unknown }, res);
});

(async () => {
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
