// Checks that the environment you are about to deploy with is complete and sensible:
//
//   npm run deploy:check                  reads .env.local (or the variables already set)
//   (set the variables from your host, then run it, to test those instead)
//
// It validates the settings exactly as the app does in production, then adds the warnings the app
// cannot know about (an http address, a local database, an unset email domain). It never prints a
// value, only variable names and what is wrong.

import { getEnv } from "@/lib/env";

Object.assign(process.env, { NODE_ENV: "production" });

const problems: string[] = [];
const warnings: string[] = [];

function main() {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Invalid environment configuration");
    return;
  }

  const appUrl = new URL(env.APP_URL);
  if (appUrl.protocol !== "https:")
    problems.push("APP_URL must be an https address in production.");
  if (["localhost", "127.0.0.1"].includes(appUrl.hostname)) {
    problems.push("APP_URL points at this machine; use the real domain.");
  }
  if (/localhost|127\.0\.0\.1/.test(env.MONGODB_URI)) {
    problems.push("MONGODB_URI points at a local database; use MongoDB Atlas.");
  }
  if (env.TOKEN_ENCRYPTION_KEY === env.SESSION_SECRET) {
    problems.push("TOKEN_ENCRYPTION_KEY must be different from SESSION_SECRET.");
  }
  const r2Set = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET];
  if (!r2Set.every(Boolean)) {
    problems.push("Photo storage is not configured: set all four R2_* variables.");
  }
  if (env.LOCAL_STORAGE_DIR) {
    problems.push(
      "LOCAL_STORAGE_DIR is set: photos would be lost on a host with a temporary disk.",
    );
  }
  if (!env.RESEND_API_KEY) {
    problems.push("RESEND_API_KEY is not set: invitation and reset emails would be refused.");
  } else if (!env.EMAIL_FROM) {
    warnings.push(
      "EMAIL_FROM is not set: Resend only delivers to your own address until a sending domain is verified.",
    );
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google sign-in is off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).");
  }
  if (!env.GOOGLE_PLACES_API_KEY) {
    warnings.push(
      "Vendor search is off (GOOGLE_PLACES_API_KEY not set); vendors are added by typing.",
    );
  }
}

main();
for (const problem of problems) console.log(` FAIL  ${problem}`);
for (const warning of warnings) console.log(` warn  ${warning}`);
if (problems.length === 0) console.log(" ok    The environment is ready for production.");
process.exitCode = problems.length === 0 ? 0 : 1;
