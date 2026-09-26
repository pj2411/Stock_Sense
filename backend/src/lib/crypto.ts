import argon2 from "argon2";
import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { env } from "../config/env";

export async function hashPassword(value: string) {
  return argon2.hash(value);
}

export async function verifyPassword(hash: string, value: string) {
  return argon2.verify(hash, value);
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createAccessToken(user: { id: string; email: string; role: string }) {
  return jwt.sign({ email: user.email, role: user.role, type: "access" }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  });
}

export function createRefreshToken(userId: string) {
  const tokenId = randomUUID();
  const token = jwt.sign({ tokenId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
  });
  return { token, tokenId };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload & { tokenId: string; type: "refresh" };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload & { role: string; email: string; type: "access" };
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}
