import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "../shared/schema.js";
import { storage } from "./storage.js";
import { AppError } from "./http.js";

const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || "canteen-connect-student-access-secret";
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "canteen-connect-student-refresh-secret";
const ACCESS_TOKEN_TTL: jwt.SignOptions["expiresIn"] = "15m";
const REFRESH_TOKEN_TTL: jwt.SignOptions["expiresIn"] = "7d";
export const REFRESH_COOKIE_NAME = "cc_student_refresh";
const TokenExpiredErrorCtor = (jwt as unknown as { TokenExpiredError?: new (...args: any[]) => Error }).TokenExpiredError;

type StudentTokenType = "access" | "refresh";

export type StudentTokenPayload = {
  sub: number;
  role: "student";
  type: StudentTokenType;
};

declare module "express-serve-static-core" {
  interface Request {
    studentUser?: {
      id: number;
      role: "student";
    };
  }
}

function signStudentToken(
  payload: StudentTokenPayload,
  secret: string,
  expiresIn: import("jsonwebtoken").SignOptions["expiresIn"],
) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function issueStudentTokens(user: Pick<User, "id" | "role">) {
  if (user.role !== "student") {
    throw new AppError(403, "Only students can request student tokens", "ROLE_FORBIDDEN");
  }

  const accessToken = signStudentToken(
    { sub: user.id, role: "student", type: "access" },
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_TTL,
  );

  const refreshToken = signStudentToken(
    { sub: user.id, role: "student", type: "refresh" },
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_TTL,
  );

  return { accessToken, refreshToken };
}

function verifyStudentToken(token: string, tokenType: StudentTokenType) {
  const secret = tokenType === "access" ? ACCESS_TOKEN_SECRET : REFRESH_TOKEN_SECRET;
  const payload = jwt.verify(token, secret) as StudentTokenPayload &
    import("jsonwebtoken").JwtPayload;

  if (payload.type !== tokenType) {
    throw new AppError(401, "Invalid token type", "TOKEN_TYPE_INVALID");
  }

  if (payload.role !== "student") {
    throw new AppError(403, "Only student tokens are accepted", "ROLE_FORBIDDEN");
  }

  return payload;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function readRefreshToken(req: Request) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    throw new AppError(401, "Refresh token is missing", "REFRESH_TOKEN_MISSING");
  }
  return token;
}

export async function buildAccessTokenFromRefresh(req: Request, res: Response) {
  let payload: StudentTokenPayload & import("jsonwebtoken").JwtPayload;
  try {
    payload = verifyStudentToken(readRefreshToken(req), "refresh");
  } catch (error) {
    clearRefreshTokenCookie(res);

    if (TokenExpiredErrorCtor && error instanceof TokenExpiredErrorCtor) {
      throw new AppError(401, "Refresh token expired", "REFRESH_TOKEN_EXPIRED");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Invalid refresh token", "REFRESH_TOKEN_INVALID");
  }

  const user = await storage.getUser(payload.sub);
  if (!user || user.role !== "student") {
    throw new AppError(401, "Student account not found", "USER_NOT_FOUND");
  }

  const tokens = issueStudentTokens(user);
  setRefreshTokenCookie(res, tokens.refreshToken);
  return tokens.accessToken;
}

export async function requireStudentJwt(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(
      new AppError(401, "Authorization token required", "AUTH_TOKEN_MISSING"),
    );
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return next(new AppError(401, "Authorization token required", "AUTH_TOKEN_MISSING"));
  }

  try {
    const payload = verifyStudentToken(token, "access");
    const user = await storage.getUser(payload.sub);

    if (!user) {
      throw new AppError(401, "Student account not found", "USER_NOT_FOUND");
    }

    if (user.role !== "student") {
      throw new AppError(403, "Student role required", "ROLE_FORBIDDEN");
    }

    req.studentUser = { id: user.id, role: "student" };
    return next();
  } catch (error) {
    if (TokenExpiredErrorCtor && error instanceof TokenExpiredErrorCtor) {
      return next(new AppError(401, "Access token expired", "TOKEN_EXPIRED"));
    }

    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(401, "Invalid access token", "TOKEN_INVALID"));
  }
}
