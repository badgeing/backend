import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default(process.env.NODE_ENV === "production" ? "production" : "development"),
    PORT: z.coerce.number().default(5179),
    HOST: z.string().default("0.0.0.0"),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    TRUSTED_ORIGINS: z.string().default("https://discord.com"),
    SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW: z.string().default("1 minute"),
    DAILY_SUBMISSION_LIMIT: z.coerce.number().default(100),
    DATABASE_URL: z.string(),
    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string(),
    DISCORD_REDIRECT_URI: z.string().url(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    MODERATOR_IDS: z.string().default(""),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.string().url().optional(),
    WEB_DASHBOARD_URL: z.string().url().optional(),
    COOKIE_SECURE: z.string().optional()
});

const parsed = envSchema.parse(process.env);

export const config = {
    ...parsed,
    isDevelopment: parsed.NODE_ENV !== "production",
    cookieSecure: parsed.COOKIE_SECURE ? parsed.COOKIE_SECURE === "true" : parsed.NODE_ENV === "production",
    corsOrigins: parsed.CORS_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean),
    trustedOrigins: parsed.TRUSTED_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean),
    moderatorIds: parsed.MODERATOR_IDS.split(",").map(id => id.trim()).filter(Boolean)
};

export type AppConfig = typeof config;
