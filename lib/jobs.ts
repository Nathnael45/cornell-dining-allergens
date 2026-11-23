/** Job entry points shared by the cron routes and the CLI scripts. Every run is logged to ingest_runs. */
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { ingestRuns } from "@/lib/db/schema";
import { fetchEateries } from "@/lib/cornell/dining-api";
import { crawlNetNutrition } from "@/lib/cornell/netnutrition";
import { ingestSnapshot } from "@/lib/ingest/ingest";
import { saveNetNutrition } from "@/lib/netnutrition/sync";

async function logged<T extends object>(db: DB, kind: "menus" | "netnutrition", fn: () => Promise<T>): Promise<T> {
  const [run] = await db.insert(ingestRuns).values({ kind }).returning({ id: ingestRuns.id });
  try {
    const stats = await fn();
    await db.update(ingestRuns).set({ status: "ok", finishedAt: new Date(), stats }).where(eq(ingestRuns.id, run.id));
    return stats;
  } catch (err) {
    await db
      .update(ingestRuns)
      .set({ status: "error", finishedAt: new Date(), error: String((err as Error)?.stack ?? err) })
      .where(eq(ingestRuns.id, run.id));
    throw err;
  }
}

export function runMenuIngest(db: DB) {
  return logged(db, "menus", async () => ingestSnapshot(db, await fetchEateries()));
}

export function runNetNutritionSync(db: DB, log?: (m: string) => void) {
  return logged(db, "netnutrition", async () => {
    const crawl = await crawlNetNutrition({ log });
    const saved = await saveNetNutrition(db, crawl);
    return { units: crawl.units, errors: crawl.errors.slice(0, 50), errorCount: crawl.errors.length, ...saved };
  });
}
