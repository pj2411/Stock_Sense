import { Prisma, type Role } from "@prisma/client";
import { env } from "../config/env";
import { createAccessToken, createRefreshToken, generateOtp, hashPassword, hashToken, verifyAccessToken, verifyPassword, verifyRefreshToken } from "../lib/crypto";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

const publicUser = { id: true, email: true, name: true, role: true, isActive: true, createdAt: true } as const;
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function tokensFor(user: { id: string; email: string; role: Role }) {
  const accessToken = createAccessToken(user);
  const { token: refreshToken } = createRefreshToken(user.id);
  return { accessToken, refreshToken };
}

async function persistRefreshToken(userId: string, refreshToken: string) {
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + refreshLifetimeMs) } });
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "EMAIL_EXISTS", "An account with this email already exists");
  const user = await prisma.user.create({ data: { name: input.name.trim(), email, passwordHash: await hashPassword(input.password) }, select: publicUser });
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user, ...tokens };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, input.password))) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  const tokens = tokensFor(user);
  await persistRefreshToken(user.id, tokens.refreshToken);
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, createdAt: user.createdAt }, ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try { payload = verifyRefreshToken(refreshToken); } catch { throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired"); }
  if (payload.type !== "refresh" || !payload.sub) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  const stored = await prisma.refreshToken.findFirst({ where: { userId: payload.sub, tokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
  if (!stored || !stored.user.isActive) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is revoked or expired");
  const tokens = tokensFor(stored.user);
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({ data: { userId: stored.user.id, tokenHash: hashToken(tokens.refreshToken), expiresAt: new Date(Date.now() + refreshLifetimeMs) } }),
  ]);
  return { user: { id: stored.user.id, email: stored.user.email, name: stored.user.name, role: stored.user.role, isActive: stored.user.isActive, createdAt: stored.user.createdAt }, ...tokens };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return user;
}

export async function forgotPassword(emailInput: string) {
  const email = emailInput.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { accepted: true };
  const code = generateOtp();
  await prisma.passwordResetOtp.create({ data: { userId: user.id, codeHash: hashToken(code), expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000) } });
  return { accepted: true, ...(env.NODE_ENV !== "production" ? { debugOtp: code } : {}) };
}

export async function verifyOtp(input: { email: string; otp: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (!user) throw new AppError(400, "INVALID_OTP", "The OTP is invalid or expired");
  const otp = await prisma.passwordResetOtp.findFirst({ where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.codeHash !== hashToken(input.otp)) throw new AppError(400, "INVALID_OTP", "The OTP is invalid or expired");
  return { resetToken: `${user.id}.${otp.id}.${hashToken(`${user.id}:${otp.id}`)}` };
}

export async function resetPassword(input: { resetToken: string; password: string }) {
  const [userId, otpId, proof] = input.resetToken.split(".");
  if (!userId || !otpId || proof !== hashToken(`${userId}:${otpId}`)) throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid");
  const otp = await prisma.passwordResetOtp.findFirst({ where: { id: otpId, userId, consumedAt: null, expiresAt: { gt: new Date() } } });
  if (!otp) throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or expired");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.password) } }),
    prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}
