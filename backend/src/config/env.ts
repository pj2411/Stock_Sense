import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "development-access-secret-change-me",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "development-refresh-secret-change-me",
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL,
  OTP_TTL_MINUTES: process.env.OTP_TTL_MINUTES,
  APP_ORIGIN: process.env.APP_ORIGIN,
});
