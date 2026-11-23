import { lt } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { netnutritionItems } from "@/lib/db/schema";
import { nameKey } from "@/lib/ingest/normalize";
import type { CrawlResult } from "@/lib/cornell/netnutrition";

/** Below this many labels we assume the crawl broke and keep the previous data. */
export const MIN_HEALTHY_LABELS = 100;

export async function saveNetNutrition(db: DB, crawl: CrawlResult, now = new Date()) {
  const rows = crawl.items.map((i) => {
    const name = i.name ?? i.listedName;
    return {
      detailOid: i.detailOid,
      unitName: i.unitName,
      name,
      nameKey: nameKey(name),
      servingSize: i.servingSize,
      ingredients: i.ingredients,
      hasContainsLine: i.hasContainsLine,
      containsRaw: i.containsRaw,
      allergens: i.allergens,
      unmappedAllergens: i.unmappedAllergens,
      fetchedAt: now,
    };
  });

  return db.transaction(async (tx) => {
    for (const r of rows) {
      await tx.insert(netnutritionItems).values(r).onConflictDoUpdate({ target: netnutritionItems.detailOid, set: r });
    }
    // Only a complete, clean crawl may delete labels we didn't see this time. A partial crawl
    // (server hiccup, circuit breaker) keeps the previous data.
    const canPrune = !crawl.aborted && crawl.errors.length === 0 && rows.length >= MIN_HEALTHY_LABELS;
    let pruned = 0;
    if (canPrune) {
      pruned = (await tx.delete(netnutritionItems).where(lt(netnutritionItems.fetchedAt, now)).returning()).length;
    }
    const unmapped = [...new Set(rows.flatMap((r) => r.unmappedAllergens))];
    return {
      saved: rows.length,
      pruned,
      prunedSkipped: !canPrune,
      aborted: crawl.aborted,
      withoutContainsLine: rows.filter((r) => !r.hasContainsLine).length,
      unmappedAllergenNames: unmapped,
    };
  });
}
