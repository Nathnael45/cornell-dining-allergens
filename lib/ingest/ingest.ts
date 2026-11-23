/**
 * Menu ingest: Cornell eateries snapshot → Postgres (ARCHITECTURE.md §6.1).
 *
 * - Idempotent: re-ingesting the same snapshot changes nothing except `last_seen_at`.
 * - Stores ALL meals/stations of the dining rooms (so widening scope later needs no re-ingest),
 *   but only queues allergen research for foods that appear in the v1 scope.
 * - Meal events that disappear from a date the snapshot still covers are deleted (cancelled meals).
 */
import { createHash } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { eateries, foodAliases, foods, mealEvents, menuItems, researchJobs, stations } from "@/lib/db/schema";
import type { EateriesResponse, MealEvent } from "@/lib/cornell/dining-api";
import { displayName, isNoticeItem, isPlaceholderName, nameKey } from "./normalize";
import { classifyStation, isAnnouncementCategory, isDiningRoom, isMealInScope, normalizeMealName } from "./scope";

export type IngestStats = {
  eateries: number;
  diningRooms: number;
  events: { seen: number; inserted: number; changed: number; unchanged: number; removed: number };
  menuItemRows: number;
  foods: { seen: number; new: number };
  stations: { new: string[]; unclassified: string[] };
  researchJobsQueued: number;
};

/**
 * Bump whenever the way an event is turned into rows changes, so the next ingest rewrites
 * events whose upstream content didn't change. v3: announcement sections + "Closed" items → meal notices.
 */
export const INGEST_LOGIC_VERSION = 3;

function eventHash(ev: MealEvent): string {
  const canonical = ev.menu.map((c) => [c.category, c.sortIdx ?? 0, c.items.map((i) => [i.item, i.sortIdx ?? 0])]);
  return createHash("sha1")
    .update(JSON.stringify([INGEST_LOGIC_VERSION, ev.startTimestamp, ev.endTimestamp, ev.calSummary ?? null, canonical]))
    .digest("hex");
}

/**
 * Split an event's menu into real food items and notices. Notices come from announcement
 * sections ("Closed") and from notice items inside normal stations ("Create: Closed").
 */
export function splitEvent(ev: MealEvent) {
  const foods: { category: string; key: string; display: string; stationSortIdx: number; sortIdx: number }[] = [];
  const notices: string[] = [];
  for (const c of ev.menu) {
    const announcement = isAnnouncementCategory(c.category);
    for (const it of c.items) {
      const display = displayName(it.item);
      if (announcement) notices.push(display);
      else if (isNoticeItem(display)) notices.push(`${c.category}: ${display}`);
      else {
        const key = nameKey(display);
        if (key) foods.push({ category: c.category, key, display, stationSortIdx: c.sortIdx ?? 0, sortIdx: it.sortIdx ?? 0 });
      }
    }
  }
  return { foods, notices };
}

function chunk<T>(arr: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function ingestSnapshot(db: DB, snapshot: EateriesResponse, now = new Date()): Promise<IngestStats> {
  const all = snapshot.data.eateries;
  const rooms = all.filter(isDiningRoom);

  const stats: IngestStats = {
    eateries: all.length,
    diningRooms: rooms.length,
    events: { seen: 0, inserted: 0, changed: 0, unchanged: 0, removed: 0 },
    menuItemRows: 0,
    foods: { seen: 0, new: 0 },
    stations: { new: [], unclassified: [] },
    researchJobsQueued: 0,
  };

  return db.transaction(async (tx) => {
    // 1. Eateries (all of them, so cafés are ready for later phases).
    for (const e of all) {
      const row = {
        id: e.id,
        slug: e.slug,
        name: e.name,
        campusArea: e.campusArea?.descrshort ?? null,
        isDiningRoom: isDiningRoom(e),
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        rawNutritionNote: e.nutrition ?? null,
        updatedAt: now,
      };
      await tx.insert(eateries).values(row).onConflictDoUpdate({ target: eateries.id, set: row });
    }

    // 2. Stations: upsert every category name; classification comes from code (scope.ts).
    const stationNames = new Set<string>();
    for (const e of rooms)
      for (const d of e.operatingHours) for (const ev of d.events) for (const c of ev.menu) stationNames.add(c.category);

    const existingStations = await tx.select({ name: stations.name }).from(stations);
    const known = new Set(existingStations.map((s) => s.name));
    for (const name of stationNames) {
      const { kind, inScope } = classifyStation(name);
      if (!known.has(name)) stats.stations.new.push(name);
      if (kind === "unclassified") stats.stations.unclassified.push(name);
      await tx
        .insert(stations)
        .values({ name, kind, inScope, firstSeenAt: now })
        .onConflictDoUpdate({ target: stations.name, set: { kind, inScope } });
    }
    const stationRows = await tx.select({ id: stations.id, name: stations.name, inScope: stations.inScope }).from(stations);
    const stationByName = new Map(stationRows.map((s) => [s.name, s]));

    // 3. Foods: resolve every distinct name key (aliases first), insert unknown ones.
    const keyToDisplay = new Map<string, string>();
    const inScopeKeys = new Set<string>();
    for (const e of rooms)
      for (const d of e.operatingHours)
        for (const ev of d.events)
          for (const { category, key, display } of splitEvent(ev).foods) {
            if (!keyToDisplay.has(key)) keyToDisplay.set(key, display);
            if (isMealInScope(ev.descr) && classifyStation(category).inScope) inScopeKeys.add(key);
          }
    const keys = [...keyToDisplay.keys()];
    stats.foods.seen = keys.length;

    const foodIdByKey = new Map<string, number>();
    for (const part of chunk(keys)) {
      for (const a of await tx.select().from(foodAliases).where(inArray(foodAliases.aliasKey, part)))
        foodIdByKey.set(a.aliasKey, a.foodId);
      for (const f of await tx.select({ id: foods.id, nameKey: foods.nameKey }).from(foods).where(inArray(foods.nameKey, part)))
        if (!foodIdByKey.has(f.nameKey)) foodIdByKey.set(f.nameKey, f.id);
    }
    const newKeys = keys.filter((k) => !foodIdByKey.has(k));
    stats.foods.new = newKeys.length;
    for (const part of chunk(newKeys, 500)) {
      const inserted = await tx
        .insert(foods)
        .values(
          part.map((k) => ({
            nameKey: k,
            displayName: keyToDisplay.get(k)!,
            isPlaceholder: isPlaceholderName(keyToDisplay.get(k)!),
            firstSeenAt: now,
            lastSeenAt: now,
          })),
        )
        .returning({ id: foods.id, nameKey: foods.nameKey });
      for (const f of inserted) foodIdByKey.set(f.nameKey, f.id);
    }
    const seenIds = [...new Set(foodIdByKey.values())];
    for (const part of chunk(seenIds)) await tx.update(foods).set({ lastSeenAt: now }).where(inArray(foods.id, part));

    // 4. Meal events + menu items.
    for (const e of rooms) {
      for (const day of e.operatingHours) {
        for (const ev of day.events) {
          stats.events.seen++;
          const meal = normalizeMealName(ev.descr);
          const startsAt = new Date(ev.startTimestamp * 1000);
          const hash = eventHash(ev);

          const [existing] = await tx
            .select({ id: mealEvents.id, contentHash: mealEvents.contentHash })
            .from(mealEvents)
            .where(
              and(
                eq(mealEvents.eateryId, e.id),
                eq(mealEvents.serviceDate, day.date),
                eq(mealEvents.meal, meal),
                eq(mealEvents.startsAt, startsAt),
              ),
            );

          let eventId: number;
          if (existing && existing.contentHash === hash) {
            await tx.update(mealEvents).set({ lastSeenAt: now }).where(eq(mealEvents.id, existing.id));
            stats.events.unchanged++;
            continue;
          }
          const values = {
            eateryId: e.id,
            serviceDate: day.date,
            meal,
            startsAt,
            endsAt: new Date(ev.endTimestamp * 1000),
            calSummary: ev.calSummary ?? null,
            notices: splitEvent(ev).notices,
            contentHash: hash,
            lastSeenAt: now,
          };
          if (existing) {
            await tx.update(mealEvents).set(values).where(eq(mealEvents.id, existing.id));
            await tx.delete(menuItems).where(eq(menuItems.mealEventId, existing.id));
            eventId = existing.id;
            stats.events.changed++;
          } else {
            const [ins] = await tx.insert(mealEvents).values(values).returning({ id: mealEvents.id });
            eventId = ins.id;
            stats.events.inserted++;
          }

          const rows = splitEvent(ev).foods.map((f) => ({
            mealEventId: eventId,
            stationId: stationByName.get(f.category)!.id,
            foodId: foodIdByKey.get(f.key)!,
            stationSortIdx: f.stationSortIdx,
            sortIdx: f.sortIdx,
          }));
          for (const part of chunk(rows)) {
            await tx.insert(menuItems).values(part).onConflictDoNothing();
          }
          stats.menuItemRows += rows.length;
        }
      }

      // 5. Remove events that vanished from dates this snapshot still covers.
      const dates = e.operatingHours.map((d) => d.date);
      if (dates.length) {
        const removed = await tx
          .delete(mealEvents)
          .where(and(eq(mealEvents.eateryId, e.id), inArray(mealEvents.serviceDate, dates), lt(mealEvents.lastSeenAt, now)))
          .returning({ id: mealEvents.id });
        stats.events.removed += removed.length;
      }
    }

    // 6. Queue research for in-scope foods that have never been researched.
    const scopeIds = [...new Set([...inScopeKeys].map((k) => foodIdByKey.get(k)!))];
    for (const part of chunk(scopeIds)) {
      const pending = await tx
        .select({ id: foods.id })
        .from(foods)
        .where(and(inArray(foods.id, part), eq(foods.researchStatus, "pending")));
      if (!pending.length) continue;
      const queued = await tx
        .insert(researchJobs)
        .values(pending.map((f) => ({ foodId: f.id, createdAt: now })))
        .onConflictDoNothing()
        .returning({ foodId: researchJobs.foodId });
      stats.researchJobsQueued += queued.length;
    }

    return stats;
  });
}
