// Starts the app for the browser tests: a throwaway in-memory MongoDB replica set, its indexes,
// a temporary photo folder, then `next start` (a production build) on E2E_PORT. Nothing here ever
// touches a real database, bucket or email account: every external setting is overridden below,
// including blanks for the ones a developer's .env.local may hold.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const port = process.env.E2E_PORT ?? "3135";

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri("mmm_e2e");
  const photoDir = mkdtempSync(path.join(os.tmpdir(), "mmm-e2e-photos-"));

  Object.assign(process.env, {
    MONGODB_URI: uri,
    APP_URL: `http://localhost:${port}`,
    SESSION_SECRET: "e2e-session-secret-".padEnd(40, "x"),
    TOKEN_ENCRYPTION_KEY: "e2e-link-encryption-key-".padEnd(40, "y"),
    LOCAL_STORAGE_DIR: photoDir,
    R2_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    R2_BUCKET: "",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_PLACES_API_KEY: "",
  });

  // Production mode does not build indexes by itself, so do it the way a deploy does.
  await import("@/models");
  await mongoose.connect(uri);
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  await mongoose.disconnect();

  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], {
    stdio: "inherit",
    env: process.env,
  });

  const stop = async () => {
    next.kill();
    await replSet.stop();
    rmSync(photoDir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
