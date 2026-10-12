import "server-only";
import { z } from "zod";

// Empty values in .env.local (copied from .env.example) count as "not set".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    // Encrypts the re-showable guest RSVP links (DB Design §5.3). Required in production; in
    // development and tests a key derived from SESSION_SECRET is used when it is not set.
    TOKEN_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(32, "TOKEN_ENCRYPTION_KEY must be at least 32 characters").optional(),
    ),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    // Server-side only: vendor search through Google Places (Architecture §28). Optional: without
    // it vendors are added by typing the details.
    GOOGLE_PLACES_API_KEY: optionalString,
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,
    // Cloudflare R2 photo storage (Architecture Amendment A1). All four or none: without them the
    // gallery stores photos on this machine's disk in development and tests, and refuses to run in
    // production.
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET: optionalString,
    // Where the development photo store keeps files; defaults to .local-storage in the project.
    LOCAL_STORAGE_DIR: optionalString,
  })
  .superRefine((env, ctx) => {
    const r2 = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET];
    if (r2.some(Boolean) && !r2.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["R2_BUCKET"],
        message:
          "Set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET, or none",
      });
    }
    if (env.NODE_ENV === "production" && !env.TOKEN_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["TOKEN_ENCRYPTION_KEY"],
        message: "TOKEN_ENCRYPTION_KEY is required in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated lazily on first use (not at import), so `next build` works without secrets.
 * The error names the offending variables but never echoes their values.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration — ${problems.join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests() {
  cached = undefined;
}
