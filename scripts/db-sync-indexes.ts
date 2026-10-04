// Applies the indexes declared in src/models to the database (DB Design §12.4.5).
// autoIndex is off in production, so run this deliberately during deploys:
//
//   npm run db:sync-indexes            dry run: shows what would be created/dropped
//   npm run db:sync-indexes -- --apply  applies it
//
// Careful: syncIndexes() DROPS indexes that are not declared in code. Always read the dry run
// first. Changing an existing TTL duration needs collMod — a plain re-create will fail.

import mongoose from "mongoose";
import { connectDb, disconnectDb } from "@/infrastructure/database/connection";
import "@/models";

const apply = process.argv.includes("--apply");

async function main() {
  const modelNames = mongoose.modelNames().sort();
  if (modelNames.length === 0) {
    console.log("No models registered in src/models/index.ts — nothing to sync.");
    return;
  }

  const { connection } = await connectDb();
  // Never print the URI itself: it contains credentials.
  console.log(`Target: host=${connection.host} database=${connection.name}`);

  let changes = 0;
  for (const name of modelNames) {
    const { toCreate, toDrop } = await mongoose.model(name).diffIndexes();
    changes += toCreate.length + toDrop.length;
    console.log(`\n${name}`);
    for (const index of toCreate) console.log(`  + create ${JSON.stringify(index)}`);
    for (const index of toDrop) console.log(`  - DROP   ${JSON.stringify(index)}`);
    if (toCreate.length + toDrop.length === 0) console.log("  (in sync)");
  }

  if (changes === 0) {
    console.log("\nAll indexes are in sync.");
    return;
  }
  if (!apply) {
    console.log(`\nDry run: ${changes} change(s). Re-run with --apply to make them.`);
    return;
  }

  for (const name of modelNames) {
    await mongoose.model(name).syncIndexes();
  }
  console.log(`\nApplied ${changes} change(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
