// Manual clean-up jobs (DB Design §10.3 and §10.4). Dry run unless --apply is given.
//
//   npm run db:purge-weddings              show weddings past their 30-day grace period
//   npm run db:purge-weddings -- --apply   delete them for good (photo files first, then rows)
//   npm run db:anonymize-users             show deleted accounts past their 30-day grace period
//   npm run db:anonymize-users -- --apply  strip their personal data
//
// This cannot be undone. Read the dry run first, and take an Atlas snapshot before the first
// real run. The job is chosen by the first argument: "weddings" or "users".

import { disconnectDb } from "@/infrastructure/database/connection";
import { anonymizeDeletedUsers, purgeWeddings } from "@/modules/maintenance/maintenance.service";
import "@/models";

const job = process.argv[2];
const apply = process.argv.includes("--apply");

async function main() {
  console.log(apply ? "APPLYING changes." : "Dry run: nothing will be changed.");
  if (job === "weddings") {
    const results = await purgeWeddings({ apply });
    if (results.length === 0) console.log("No weddings are past their grace period.");
    for (const result of results) {
      console.log(`\nWedding ${result.weddingId} "${result.title}"`);
      console.log(`  rows: ${JSON.stringify(result.rows)}`);
      if (apply) console.log(`  photo files removed: ${result.filesRemoved}`);
      if (result.error) {
        console.log(`  SKIPPED: ${result.error}`);
        process.exitCode = 1;
      }
    }
  } else if (job === "users") {
    const { userIds, anonymized } = await anonymizeDeletedUsers({ apply });
    console.log(`${userIds.length} account(s) are past their grace period.`);
    if (apply) console.log(`${anonymized} anonymised.`);
  } else {
    console.error("Usage: db-maintenance.ts <weddings|users> [--apply]");
    process.exitCode = 2;
  }
  if (!apply && (job === "weddings" || job === "users")) {
    console.log("\nRe-run with --apply to make the changes.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
