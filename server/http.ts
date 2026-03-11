import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code = "APP_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  code: string;
  details?: unknown;
};

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Request successful",
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  } satisfies ApiSuccess<T>);
}

export function sendFailure(
  res: Response,
  statusCode: number,
  message: string,
  code = "REQUEST_FAILED",
  details?: unknown,
) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    details,
  } satisfies ApiFailure);
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
