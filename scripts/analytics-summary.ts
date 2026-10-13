// Prints the product numbers for the last N days (default 30):
//
//   npm run analytics:summary
//   npm run analytics:summary -- 7
//
// Only counts per day are stored (see src/models/analyticsCounter.model.ts): nothing here can
// identify a person or a wedding.

import { disconnectDb } from "@/infrastructure/database/connection";
import { summarize } from "@/modules/analytics/analytics.service";
import "@/models";

const days = Math.min(Math.max(Number(process.argv[2]) || 30, 1), 400);

async function main() {
  const summary = await summarize(days);
  console.log(`Last ${summary.days} days (from ${summary.fromDay}, UTC)\n`);
  for (const [event, count] of Object.entries(summary.totals)) {
    console.log(`${event.padEnd(20)} ${count}`);
  }
  if (summary.signupToWedding !== null) {
    console.log(`\nSignups that created a wedding: ${Math.round(summary.signupToWedding * 100)}%`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
