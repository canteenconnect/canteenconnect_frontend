import type { Express } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import rateLimit from "express-rate-limit";
import { promisify } from "util";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { z } from "zod";
import { insertUserSchema, type User } from "../shared/schema.js";
import { storage } from "./storage.js";
import { sendFailure, sendSuccess } from "./http.js";
import {
  buildAccessTokenFromRefresh,
  clearRefreshTokenCookie,
  issueStudentTokens,
  setRefreshTokenCookie,
} from "./studentAuth.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function toPublicUser(user: User, accessToken?: string) {
  const { password, ...safeUser } = user;
  if (accessToken) {
    return { ...safeUser, accessToken };
  }
  return safeUser;
}

function getLoginSchema() {
  return z.object({
    username: z.string().trim().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  });
}

function studentAccessTokenResponse(user: User) {
  if (user.role !== "student") return undefined;
  const { accessToken, refreshToken } = issueStudentTokens(user);
  return { accessToken, refreshToken };
}

export function setupAuth(app: Express) {
  const authRateLimitMessage = {
    success: false,
    message: "Too many authentication requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  };

  const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ...authRateLimitMessage,
      message: "Too many login attempts. Please retry in 10 minutes.",
    },
  });

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: authRateLimitMessage,
  });

  const refreshLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: authRateLimitMessage,
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r8q,+&1LM3)CD*zAGpx1xm{NeQHc;#",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false);
        if (!(await comparePasswords(password, user.password))) return done(null, false);
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (error) {
      done(error as Error);
    }
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    const parsed = getLoginSchema().safeParse(req.body);
    if (!parsed.success) {
      return sendFailure(res, 400, "Invalid login payload", "VALIDATION_ERROR", parsed.error.flatten());
    }

    passport.authenticate("local", (authErr: Error | null, user: User | false) => {
      if (authErr) return next(authErr);
      if (!user) {
        return sendFailure(res, 401, "Invalid username or password", "INVALID_CREDENTIALS");
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);

        const tokens = studentAccessTokenResponse(user);
        if (tokens?.refreshToken) {
          setRefreshTokenCookie(res, tokens.refreshToken);
        }

        return res.status(200).json(toPublicUser(user, tokens?.accessToken));
      });
    })(req, res, next);
  });

  app.post("/api/register", registerLimiter, async (req, res, next) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendFailure(
          res,
          400,
          "Invalid registration payload",
          "VALIDATION_ERROR",
          parsed.error.flatten(),
        );
      }

      const existingUser = await storage.getUserByUsername(parsed.data.username);
      if (existingUser) {
        return sendFailure(res, 409, "Username already exists", "USERNAME_EXISTS");
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);

        const tokens = studentAccessTokenResponse(user);
        if (tokens?.refreshToken) {
          setRefreshTokenCookie(res, tokens.refreshToken);
        }

        return res.status(201).json(toPublicUser(user, tokens?.accessToken));
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    clearRefreshTokenCookie(res);
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        sendSuccess(res, {}, "Logged out successfully");
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
    }

    const user = req.user as User;
    return res.status(200).json(toPublicUser(user));
  });

  app.get("/api/auth/token", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return sendFailure(res, 401, "Unauthorized", "UNAUTHORIZED");
      }

      const user = req.user as User;
      if (user.role !== "student") {
        return sendFailure(res, 403, "Student role required", "ROLE_FORBIDDEN");
      }

      const { accessToken, refreshToken } = issueStudentTokens(user);
      setRefreshTokenCookie(res, refreshToken);
      return sendSuccess(res, { accessToken }, "Student token issued");
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/refresh", refreshLimiter, async (req, res, next) => {
    try {
      const accessToken = await buildAccessTokenFromRefresh(req, res);
      return sendSuccess(res, { accessToken }, "Access token refreshed");
    } catch (error) {
      next(error);
    }
  });
}
