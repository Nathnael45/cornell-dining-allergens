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
import { refloorPlaceholders, runGlutenBackfill, runResearchBatch } from "@/lib/research/worker";
import { runRoleBackfill } from "@/lib/research/roles";

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  // Migrations should bypass the connection pooler (Neon provides a direct URL for this).
  if (cmd === "migrate" && process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  }
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset").hostname;
  console.error(`[db] ${host}`); // which database we're about to touch (host only, never credentials)
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
    case "research": {
      // Research up to N queued foods (default 25). Spends Anthropic credits.
      const stats = await runResearchBatch(db, { limit: Number(arg ?? 25), concurrency: Number(process.env.RESEARCH_CONCURRENCY ?? 4), log: (m) => console.error(m) });
      console.log(JSON.stringify({ ...stats, costUsd: Number(stats.costUsd.toFixed(3)) }, null, 2));
      break;
    }
    case "gluten": {
      // Add gluten-free likelihood ratings to researched foods missing one (~$0.001 each).
      const stats = await runGlutenBackfill(db, { limit: Number(arg ?? 100), log: (m) => console.error(m) });
      console.log(JSON.stringify({ ...stats, costUsd: Number(stats.costUsd.toFixed(3)) }));
      break;
    }
    case "roles": {
      // Classify foods as main / side / sauce / dessert / drink (batched, ~$0.005 per 25 foods).
      const stats = await runRoleBackfill(db, { limit: Number(arg ?? 1000), log: (m) => console.error(m) });
      console.log(JSON.stringify({ ...stats, costUsd: Number(stats.costUsd.toFixed(3)) }));
      break;
    }
    case "refloor":
      // Re-apply name rules to placeholder profiles ("Chef's Choice Pasta" → gluten). No API calls.
      console.log(JSON.stringify(await refloorPlaceholders(db, (m) => console.error(m))));
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
