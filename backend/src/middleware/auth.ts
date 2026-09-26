import type { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/crypto";
import { AppError } from "../lib/http";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: Role };
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "UNAUTHENTICATED", "Bearer token is required");
    const token = verifyAccessToken(header.slice(7));
    if (token.type !== "access" || !token.sub) throw new AppError(401, "INVALID_TOKEN", "Invalid access token");
    req.user = { id: token.sub, email: token.email, role: token.role as Role };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, "INVALID_TOKEN", "Invalid or expired access token"));
  }
};

export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED", "Authentication is required"));
    if (roles.length > 0 && !roles.includes(req.user.role)) return next(new AppError(403, "FORBIDDEN", "You do not have permission for this operation"));
    next();
  };
}
