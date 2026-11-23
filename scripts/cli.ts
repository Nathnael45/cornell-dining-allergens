/**
 * Local CLI: npm run db:migrate | ingest | ingest:file <path> | netnutrition
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { readFile } from "node:fs/promises";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { closeDb, getDb } from "@/lib/db/client";
import { parseEateries } from "@/lib/cornell/dining-api";
import { ingestSnapshot } from "@/lib/ingest/ingest";
import { runMenuIngest, runNetNutritionSync } from "@/lib/jobs";

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const db = getDb();
  switch (cmd) {
    case "migrate":
      await migrate(db as unknown as NodePgDatabase, { migrationsFolder: "./drizzle" });
      console.log("migrations applied");
      break;
    case "ingest":
      console.log(JSON.stringify(await runMenuIngest(db), null, 2));
      break;
    case "ingest:file": {
      if (!arg) throw new Error("usage: ingest:file <snapshot.json>");
      const snap = parseEateries(JSON.parse(await readFile(arg, "utf8")));
      console.log(JSON.stringify(await ingestSnapshot(db, snap), null, 2));
      break;
    }
    case "netnutrition":
      console.log(JSON.stringify(await runNetNutritionSync(db, (m) => console.error(m)), null, 2));
      break;
    default:
      throw new Error(`unknown command "${cmd}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
