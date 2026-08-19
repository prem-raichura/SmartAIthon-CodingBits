import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000,http://localhost:19006,http://127.0.0.1:5173'),
  // Express body limit for JSON payloads (the analytics bundle posted to
  // /api/csv/store). Keep <= 4mb when deploying behind a serverless host.
  JSON_BODY_LIMIT: z.string().default('25mb'),
  EMAIL_MODE: z.enum(['stub', 'smtp']).default('stub'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  PUSH_MODE: z.enum(['stub', 'expo']).default('stub'),
  PY_SERVICE_URL: z.string().default('http://localhost:8077'),
  GEOFENCE_RADIUS_M: z.coerce.number().default(500),
  REMINDER_CRON: z.string().default('*/5 * * * *'),
  // Optional: when unset, POST /api/uploads writes to the local uploads/ dir
  // instead of Cloudinary, so the server runs with no cloud account.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Public origin used to build absolute URLs for locally stored uploads.
  PUBLIC_URL: z.string().optional(),
  // Shared secret so a platform scheduler (e.g. Vercel Cron) can trigger the
  // reminder sweep without an admin JWT. Unset = only admins can trigger it.
  CRON_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // This runs at import time, so a failure here takes down the whole process —
  // on Vercel that surfaces only as FUNCTION_INVOCATION_FAILED. Name the exact
  // variables so the platform log is actionable.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(
    `\n[env] Invalid or missing environment variables:\n${issues}\n\n` +
      'Set these in your hosting provider (Vercel → Settings → Environment Variables) ' +
      'or in server/.env for local runs. See server/.env.example.\n',
  );
  throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
}

export const env = parsed.data;

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
