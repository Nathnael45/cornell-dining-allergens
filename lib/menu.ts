/**
 * Read side for the website: one cached call per date (revalidated by the ingest cron).
 */
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { allergenProfiles, eateries, foods, mealEvents, menuItems, stations } from "@/lib/db/schema";
import { encode, type CompactItem } from "@/lib/allergens/buckets";
import { resolve, type Resolved, type StoredProfile } from "@/lib/allergens/resolve";
import { MEALS_IN_SCOPE } from "@/lib/ingest/scope";

export const MEAL_ORDER = ["Breakfast", "Brunch", "Lunch", "Dinner"];

export type Station = { name: string; items: CompactItem[] };
export type Meal = { meal: string; startsAt: string; endsAt: string; notices: string[]; stations: Station[] };
export type Hall = { id: number; slug: string; name: string; area: string | null; meals: Meal[] };
export type Day = { date: string; halls: Hall[]; meals: string[] };

export function ithacaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

/** `today` is an argument (not read inside the cache) so the list rolls over at midnight. */
export async function getDates(today: string): Promise<string[]> {
  "use cache";
  cacheTag("menus");
  cacheLife("hours");
  const rows = await getDb()
    .selectDistinct({ d: mealEvents.serviceDate })
    .from(mealEvents)
    .where(gte(mealEvents.serviceDate, today))
    .orderBy(asc(mealEvents.serviceDate))
    .limit(7);
  return rows.map((r) => r.d);
}

type ProfileRow = StoredProfile & { foodId: number; source: string };

async function currentProfiles(foodIds: number[]): Promise<Map<number, { ai: StoredProfile | null; official: StoredProfile | null }>> {
  const out = new Map<number, { ai: StoredProfile | null; official: StoredProfile | null }>();
  if (!foodIds.length) return out;
  const rows = (await getDb()
    .select({
      foodId: allergenProfiles.foodId,
      source: allergenProfiles.source,
      allergens: allergenProfiles.allergens,
      diets: allergenProfiles.diets,
      flags: allergenProfiles.flags,
      likelyIngredients: allergenProfiles.likelyIngredients,
    })
    .from(allergenProfiles)
    .where(and(inArray(allergenProfiles.foodId, foodIds), eq(allergenProfiles.isCurrent, true)))) as ProfileRow[];
  for (const r of rows) {
    const e = out.get(r.foodId) ?? { ai: null, official: null };
    if (r.source === "ai") e.ai = r;
    if (r.source === "cornell_official") e.official = r;
    out.set(r.foodId, e);
  }
  return out;
}

export async function getDay(date: string): Promise<Day> {
  "use cache";
  cacheTag("menus");
  cacheLife("hours");
  const db = getDb();
  const events = await db
    .select({
      id: mealEvents.id,
      eateryId: eateries.id,
      slug: eateries.slug,
      name: eateries.name,
      area: eateries.campusArea,
      meal: mealEvents.meal,
      startsAt: mealEvents.startsAt,
      endsAt: mealEvents.endsAt,
      notices: mealEvents.notices,
    })
    .from(mealEvents)
    .innerJoin(eateries, eq(eateries.id, mealEvents.eateryId))
    .where(and(eq(mealEvents.serviceDate, date), eq(eateries.isDiningRoom, true), inArray(mealEvents.meal, [...MEALS_IN_SCOPE])))
    .orderBy(asc(mealEvents.startsAt));

  // Every dining room is listed, even when it serves nothing that day (e.g. closed for a break).
  const rooms = await db
    .select({ id: eateries.id, slug: eateries.slug, name: eateries.name, area: eateries.campusArea })
    .from(eateries)
    .where(eq(eateries.isDiningRoom, true));
  const halls = new Map<number, Hall>(rooms.map((r) => [r.id, { ...r, meals: [] }]));
  if (!events.length) return { date, halls: [...halls.values()].sort((a, b) => a.name.localeCompare(b.name)), meals: [] };

  const items = await db
    .select({
      eventId: menuItems.mealEventId,
      station: stations.name,
      stationSort: menuItems.stationSortIdx,
      sort: menuItems.sortIdx,
      foodId: foods.id,
      name: foods.displayName,
      placeholder: foods.isPlaceholder,
      role: foods.role,
    })
    .from(menuItems)
    .innerJoin(stations, eq(stations.id, menuItems.stationId))
    .innerJoin(foods, eq(foods.id, menuItems.foodId))
    .where(and(inArray(menuItems.mealEventId, events.map((e) => e.id)), eq(stations.inScope, true)))
    .orderBy(asc(menuItems.stationSortIdx), asc(menuItems.sortIdx), sql`${foods.displayName}`);

  const profiles = await currentProfiles([...new Set(items.map((i) => i.foodId))]);
  for (const ev of events) {
    const hall = halls.get(ev.eateryId) ?? { id: ev.eateryId, slug: ev.slug, name: ev.name, area: ev.area, meals: [] };
    const byStation = new Map<string, Station>();
    for (const it of items.filter((i) => i.eventId === ev.id)) {
      const p = profiles.get(it.foodId) ?? { ai: null, official: null };
      const r = resolve(p.ai, p.official, { eateryId: ev.eateryId, station: it.station });
      const st = byStation.get(it.station) ?? { name: it.station, items: [] };
      st.items.push({
        id: it.foodId,
        name: it.name,
        ...encode(r),
        placeholder: it.placeholder || r.placeholder || undefined,
        fried: r.fried || undefined,
        role: it.role ?? undefined,
      });
      byStation.set(it.station, st);
    }
    hall.meals.push({
      meal: ev.meal,
      startsAt: ev.startsAt.toISOString(),
      endsAt: ev.endsAt.toISOString(),
      notices: ev.notices,
      stations: [...byStation.values()],
    });
    halls.set(ev.eateryId, hall);
  }
  const meals = MEAL_ORDER.filter((m) => events.some((e) => e.meal === m));
  return { date, halls: [...halls.values()].sort((a, b) => a.name.localeCompare(b.name)), meals };
}

/** Full detail for one item at one hall/station (reasons, sources, ingredients). */
export async function getFoodDetail(foodId: number, eateryId: number, station: string): Promise<(Resolved & { name: string }) | null> {
  "use cache";
  cacheTag("menus");
  cacheLife("hours");
  const [food] = await getDb().select({ name: foods.displayName }).from(foods).where(eq(foods.id, foodId));
  if (!food) return null;
  const p = (await currentProfiles([foodId])).get(foodId) ?? { ai: null, official: null };
  return { name: food.name, ...resolve(p.ai, p.official, { eateryId, station }) };
}
