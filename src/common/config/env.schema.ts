import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  AUTH_PROVIDER: z.enum(['mock', 'firebase']).default('mock'),
  AUTH_JWT_SECRET: z.string().min(8).default('dev-secret-change-me'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  API_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
