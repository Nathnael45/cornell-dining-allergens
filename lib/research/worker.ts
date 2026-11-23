/**
 * Research worker: research_jobs → allergen_profiles (ARCHITECTURE.md §6.4).
 */
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { allergenProfiles, eateries, foods, mealEvents, menuItems, netnutritionItems, researchJobs, stations } from "@/lib/db/schema";
import { unknownProfile, type AllergenProfileData } from "@/lib/allergens/status";
import { RESEARCH_MODEL } from "./config";
import { costUsd } from "./llm";
import { officialProfile } from "./official";
import { PROMPT_VERSION, type ResearchInput } from "./prompt";
import { finalize, researchFood, type ResearchOptions } from "./research";
import { buildIndex } from "./retrieve";
import { rateGlutenFree, type GfRating } from "./gluten";

const MAX_ATTEMPTS = 3;

/** Claim up to `limit` jobs (stale locks older than 15 min are reclaimable). */
async function claim(db: DB, limit: number): Promise<number[]> {
  // Both drivers we use (node-postgres, PGlite) return { rows }.
  const res = (await db.execute(sql`
    update research_jobs set locked_at = now(), attempts = attempts + 1
    where food_id in (
      select food_id from research_jobs
      where (locked_at is null or locked_at < now() - interval '15 minutes') and attempts < ${MAX_ATTEMPTS}
      order by created_at, food_id limit ${limit}
      for update skip locked)
    returning food_id`)) as unknown as { rows: { food_id: number }[] };
  return res.rows.map((r) => r.food_id);
}

async function buildInput(db: DB, foodId: number, search: ReturnType<typeof buildIndex<typeof netnutritionItems.$inferSelect>>): Promise<ResearchInput> {
  const [food] = await db.select().from(foods).where(eq(foods.id, foodId));
  const where = await db
    .selectDistinct({ hall: eateries.name, station: stations.name, meal: mealEvents.meal, eventId: mealEvents.id, stationId: stations.id })
    .from(menuItems)
    .innerJoin(mealEvents, eq(mealEvents.id, menuItems.mealEventId))
    .innerJoin(eateries, eq(eateries.id, mealEvents.eateryId))
    .innerJoin(stations, eq(stations.id, menuItems.stationId))
    .where(eq(menuItems.foodId, foodId))
    .limit(20);
  const servedAt = [...new Set(where.map((w) => `${w.hall} · ${w.station} station · ${w.meal}`))];
  const siblings = where.length
    ? (
        await db
          .selectDistinct({ name: foods.displayName })
          .from(menuItems)
          .innerJoin(foods, eq(foods.id, menuItems.foodId))
          .where(and(eq(menuItems.mealEventId, where[0].eventId), eq(menuItems.stationId, where[0].stationId)))
      )
        .map((s) => s.name)
        .filter((n) => n !== food.displayName)
    : [];
  const references = search(food.displayName, 5).map((r) => ({
    name: r.name,
    contains: r.hasContainsLine ? r.containsRaw : null,
    ingredients: r.ingredients,
  }));
  return { name: food.displayName, servedAt, siblings, references };
}

const row = (p: AllergenProfileData) => ({
  allergens: p.allergens,
  diets: p.diets,
  likelyIngredients: p.likelyIngredients,
});

/** Make `profile` the current one for (food, source), keeping history. */
async function saveProfile(db: DB, foodId: number, values: Omit<typeof allergenProfiles.$inferInsert, "foodId" | "isCurrent">) {
  await db
    .update(allergenProfiles)
    .set({ isCurrent: false })
    .where(and(eq(allergenProfiles.foodId, foodId), eq(allergenProfiles.source, values.source), eq(allergenProfiles.isCurrent, true)));
  await db.insert(allergenProfiles).values({ ...values, foodId, isCurrent: true });
}

export type WorkerStats = { claimed: number; done: number; needsReview: number; failed: number; official: number; costUsd: number };

export type GfFlag = { rating: GfRating; reason: string; model: string; promptVersion: string };

type WorkerOptions = { limit?: number; concurrency?: number; log?: (m: string) => void; rateGf?: typeof rateGlutenFree } & ResearchOptions;

export async function runResearchBatch(db: DB, opts: WorkerOptions = {}): Promise<WorkerStats> {
  const log = opts.log ?? (() => {});
  const rateGf = opts.rateGf ?? rateGlutenFree;
  const labels = await db.select().from(netnutritionItems);
  const search = buildIndex(labels);
  const ids = await claim(db, opts.limit ?? 25);
  const stats: WorkerStats = { claimed: ids.length, done: 0, needsReview: 0, failed: 0, official: 0, costUsd: 0 };

  const queue = [...ids];
  await Promise.all(
    Array.from({ length: opts.concurrency ?? 4 }, async () => {
      for (let foodId = queue.shift(); foodId !== undefined; foodId = queue.shift()) {
        try {
          const input = await buildInput(db, foodId, search);
          const [food] = await db.select({ nameKey: foods.nameKey }).from(foods).where(eq(foods.id, foodId));

          const official = officialProfile(labels.filter((l) => l.nameKey === food.nameKey));
          if (official) {
            await saveProfile(db, foodId, { source: "cornell_official", sourceRef: food.nameKey, ...row(official), flags: { treeNutTypes: official.treeNutTypes } });
            stats.official++;
          }

          const r = await researchFood(input, opts);
          const model = r.models.join(",") || null;
          stats.costUsd += costUsd(r.models[0] ?? RESEARCH_MODEL, r.usage);

          // Gluten-free likelihood (recipe-based). Optional: a failure here never blocks the profile.
          let gf: GfFlag | null = null;
          if (r.kind === "researched") {
            try {
              const g = await rateGf({ name: input.name, servedAt: input.servedAt, likelyIngredients: r.profile.likelyIngredients, references: input.references });
              gf = { rating: g.rating, reason: g.reason, model: g.model, promptVersion: g.promptVersion };
              stats.costUsd += costUsd(g.model, g.usage);
            } catch (e) {
              log(`  (no gluten-free rating for ${input.name}: ${(e as Error).message})`);
            }
          }
          await saveProfile(db, foodId, {
            source: "ai",
            ...row(r.profile),
            flags: { kind: r.kind, fried: r.profile.fried, treeNutTypes: r.profile.treeNutTypes, hardDisagreements: r.hardDisagreements, floorHits: r.floorHits, gf },
            reasoning: r.runs.length ? `${r.runs.length} runs merged conservatively; floor hits: ${r.floorHits.map((h) => `${h.allergen}:${h.matched}`).join(", ") || "none"}` : r.kind,
            model,
            promptVersion: PROMPT_VERSION,
          });

          const status = r.hardDisagreements.length ? "needs_review" : "done";
          await db.update(foods).set({ researchStatus: status }).where(eq(foods.id, foodId));
          await db.delete(researchJobs).where(eq(researchJobs.foodId, foodId));
          if (status === "needs_review") stats.needsReview++;
          else stats.done++;
          log(`${status === "done" ? "✓" : "?"} ${input.name}${r.hardDisagreements.length ? ` (runs disagree: ${r.hardDisagreements.join(", ")})` : ""}`);
        } catch (e) {
          stats.failed++;
          const msg = String((e as Error).message ?? e).slice(0, 500);
          const [job] = await db
            .update(researchJobs)
            .set({ lockedAt: null, lastError: msg })
            .where(eq(researchJobs.foodId, foodId))
            .returning({ attempts: researchJobs.attempts });
          if (job && job.attempts >= MAX_ATTEMPTS) await db.update(foods).set({ researchStatus: "failed" }).where(eq(foods.id, foodId));
          log(`! food ${foodId}: ${msg}`);
        }
      }
    }),
  );
  return stats;
}

/** Add gluten-free ratings to already-researched foods that don't have one yet. */
export async function runGlutenBackfill(db: DB, opts: { limit?: number; concurrency?: number; log?: (m: string) => void; rateGf?: typeof rateGlutenFree } = {}) {
  const log = opts.log ?? (() => {});
  const rateGf = opts.rateGf ?? rateGlutenFree;
  const rows = await db
    .select({ id: allergenProfiles.id, foodId: allergenProfiles.foodId, name: foods.displayName, likely: allergenProfiles.likelyIngredients })
    .from(allergenProfiles)
    .innerJoin(foods, eq(foods.id, allergenProfiles.foodId))
    .where(
      and(
        eq(allergenProfiles.source, "ai"),
        eq(allergenProfiles.isCurrent, true),
        sql`${allergenProfiles.flags}->>'kind' = 'researched'`,
        sql`${allergenProfiles.flags}->'gf' is null or ${allergenProfiles.flags}->'gf' = 'null'::jsonb`,
      ),
    )
    .limit(opts.limit ?? 100);
  const labels = await db.select().from(netnutritionItems);
  const search = buildIndex(labels);
  const stats = { rated: 0, failed: 0, costUsd: 0 };
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: opts.concurrency ?? 6 }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        try {
          const references = search(p.name, 3).map((r) => ({ name: r.name, contains: r.hasContainsLine ? r.containsRaw : null }));
          const g = await rateGf({ name: p.name, likelyIngredients: p.likely ?? [], references });
          const gf: GfFlag = { rating: g.rating, reason: g.reason, model: g.model, promptVersion: g.promptVersion };
          await db
            .update(allergenProfiles)
            .set({ flags: sql`${allergenProfiles.flags} || ${JSON.stringify({ gf })}::jsonb` })
            .where(eq(allergenProfiles.id, p.id));
          stats.rated++;
          stats.costUsd += costUsd(g.model, g.usage);
          log(`${g.rating.padEnd(11)} ${p.name}`);
        } catch (e) {
          stats.failed++;
          log(`! ${p.name}: ${(e as Error).message}`);
        }
      }
    }),
  );
  return stats;
}

/** Re-apply the name rules to stored placeholder profiles (no API calls). */
export async function refloorPlaceholders(db: DB, log: (m: string) => void = () => {}) {
  const rows = await db
    .select({ id: allergenProfiles.id, name: foods.displayName, flags: allergenProfiles.flags })
    .from(allergenProfiles)
    .innerJoin(foods, eq(foods.id, allergenProfiles.foodId))
    .where(and(eq(allergenProfiles.source, "ai"), eq(allergenProfiles.isCurrent, true), sql`${allergenProfiles.flags}->>'kind' = 'placeholder'`));
  let changed = 0;
  for (const r of rows) {
    const { profile, floorHits } = finalize(unknownProfile("changes day to day; check the station"), r.name);
    await db
      .update(allergenProfiles)
      .set({ allergens: profile.allergens, diets: profile.diets, flags: { ...(r.flags as object), floorHits } })
      .where(eq(allergenProfiles.id, r.id));
    if (floorHits.length) changed++;
    log(`${floorHits.length ? floorHits.map((h) => `${h.allergen}:${h.matched}`).join(", ") : "-"}  ${r.name}`);
  }
  return { placeholders: rows.length, withHits: changed };
}
