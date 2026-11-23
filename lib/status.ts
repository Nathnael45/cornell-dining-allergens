/** Read-side queries for the Phase 0 status page. */
import { and, count, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { eateries, foods, ingestRuns, mealEvents, menuItems, netnutritionItems, researchJobs, stations } from "@/lib/db/schema";
import { MEALS_IN_SCOPE } from "@/lib/ingest/scope";

/** Cornell's local date (dining days are Ithaca days, not UTC days). */
export function ithacaDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

export async function getStatus(db: DB, date = ithacaDate()) {
  const lastRuns = await db
    .select()
    .from(ingestRuns)
    .where(sql`${ingestRuns.id} in (select max(id) from ingest_runs group by kind)`)
    .orderBy(ingestRuns.kind);

  const [[foodCount], [placeholderCount], [jobCount], [nnCount], [nnMatches]] = await Promise.all([
    db.select({ c: count() }).from(foods),
    db.select({ c: count() }).from(foods).where(eq(foods.isPlaceholder, true)),
    db.select({ c: count() }).from(researchJobs),
    db.select({ c: count() }).from(netnutritionItems),
    db
      .select({ c: sql<number>`count(distinct ${foods.id})`.mapWith(Number) })
      .from(foods)
      .innerJoin(netnutritionItems, eq(netnutritionItems.nameKey, foods.nameKey)),
  ]);

  const meals = [...MEALS_IN_SCOPE];
  const halls = await db
    .select({
      id: eateries.id,
      name: eateries.name,
      area: eateries.campusArea,
      meal: mealEvents.meal,
      startsAt: mealEvents.startsAt,
      endsAt: mealEvents.endsAt,
      items: sql<number>`count(${menuItems.foodId}) filter (where ${stations.inScope})`.mapWith(Number),
    })
    .from(mealEvents)
    .innerJoin(eateries, eq(eateries.id, mealEvents.eateryId))
    .leftJoin(menuItems, eq(menuItems.mealEventId, mealEvents.id))
    .leftJoin(stations, eq(stations.id, menuItems.stationId))
    .where(and(eq(mealEvents.serviceDate, date), sql`${mealEvents.meal} in ${meals}`))
    .groupBy(eateries.id, eateries.name, eateries.campusArea, mealEvents.id)
    .orderBy(eateries.campusArea, eateries.name, mealEvents.startsAt);

  const unclassified = await db.select({ name: stations.name }).from(stations).where(eq(stations.kind, "unclassified"));

  return {
    date,
    lastRuns,
    counts: {
      foods: foodCount.c,
      placeholders: placeholderCount.c,
      researchQueue: jobCount.c,
      netnutritionLabels: nnCount.c,
      foodsWithOfficialLabel: nnMatches.c,
    },
    halls,
    unclassified: unclassified.map((s) => s.name),
  };
}


