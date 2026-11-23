import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { count, eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DB } from "@/lib/db/client";
import { eateries, foods, mealEvents, menuItems, researchJobs, stations } from "@/lib/db/schema";
import type { EateriesResponse } from "@/lib/cornell/dining-api";
import { ingestSnapshot } from "@/lib/ingest/ingest";
import { isNoticeItem, nameKey } from "@/lib/ingest/normalize";
import { classifyStation, isDiningRoom, isMealInScope } from "@/lib/ingest/scope";
import { testDb } from "./helpers/db";
import { snapshot } from "./fixtures";

let db: DB;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await testDb()));
afterEach(async () => close());

const n = async (t: PgTable) => (await db.select({ c: count() }).from(t))[0].c;

function expectedFromSnapshot(snap: EateriesResponse) {
  const rooms = snap.data.eateries.filter(isDiningRoom);
  const keys = new Set<string>();
  const inScope = new Set<string>();
  let events = 0;
  for (const e of rooms)
    for (const d of e.operatingHours)
      for (const ev of d.events) {
        events++;
        for (const c of ev.menu)
          for (const it of c.items) {
            if (isNoticeItem(it.item) || c.category.includes("Announcement")) continue;
            keys.add(nameKey(it.item));
            if (isMealInScope(ev.descr) && classifyStation(c.category).inScope) inScope.add(nameKey(it.item));
          }
      }
  return { events, foods: keys.size, inScope: inScope.size };
}

describe("ingestSnapshot", () => {
  it("loads the real snapshot", async () => {
    const snap = snapshot();
    const exp = expectedFromSnapshot(snap);
    const stats = await ingestSnapshot(db, snap, new Date("2026-11-20T23:00:00Z"));

    expect(stats.diningRooms).toBe(10);
    expect(await n(eateries)).toBe(32);
    expect(stats.events.inserted).toBe(exp.events);
    expect(await n(mealEvents)).toBe(exp.events);
    expect(await n(foods)).toBe(exp.foods);
    expect(stats.stations.unclassified).toEqual([]);

    // Research is queued only for main-meal-scope foods (~926 on this snapshot).
    expect(stats.researchJobsQueued).toBe(exp.inScope);
    expect(exp.inScope).toBeGreaterThan(850);
    expect(exp.inScope).toBeLessThan(exp.foods);

    const placeholder = await db.select().from(foods).where(eq(foods.nameKey, nameKey("Chef's Choice")));
    expect(placeholder[0]?.isPlaceholder).toBe(true);

    const halal = await db.select().from(stations).where(eq(stations.name, "Halal"));
    expect(halal[0]).toMatchObject({ kind: "main", inScope: true });
    const dessert = await db.select().from(stations).where(eq(stations.name, "Dessert"));
    expect(dessert[0]).toMatchObject({ kind: "dessert", inScope: false });
  });

  it("is idempotent", async () => {
    const snap = snapshot();
    await ingestSnapshot(db, snap, new Date("2026-11-20T23:00:00Z"));
    const before = { items: await n(menuItems), foods: await n(foods), jobs: await n(researchJobs) };

    const again = await ingestSnapshot(db, snap, new Date("2026-11-21T00:00:00Z"));
    expect(again.events.inserted).toBe(0);
    expect(again.events.changed).toBe(0);
    expect(again.events.removed).toBe(0);
    expect(again.foods.new).toBe(0);
    expect(again.researchJobsQueued).toBe(0);
    expect({ items: await n(menuItems), foods: await n(foods), jobs: await n(researchJobs) }).toEqual(before);
  });

  it("turns '* Announcements *' sections into meal notices, not foods", async () => {
    const snap = structuredClone(snapshot());
    const ev = snap.data.eateries.find((e) => e.id === 27)!.operatingHours[2].events[0];
    ev.menu.push({ category: "* Announcements *", sortIdx: 0, items: [{ item: "Closed", healthy: false, sortIdx: 1 }] });

    const stats = await ingestSnapshot(db, snap, new Date("2026-11-20T23:00:00Z"));
    expect(stats.stations.unclassified).toEqual([]);

    const [row] = await db
      .select({ notices: mealEvents.notices })
      .from(mealEvents)
      .where(sql`${mealEvents.eateryId} = 27 and ${mealEvents.startsAt} = ${new Date(ev.startTimestamp * 1000).toISOString()}`);
    expect(row.notices).toEqual(["Closed"]);
    expect(await db.select().from(foods).where(eq(foods.nameKey, "closed"))).toHaveLength(0);

    // Real data: North Star listed "Closed" as the only item under its "Create" station.
    const northStar = await db
      .select({ notices: mealEvents.notices })
      .from(mealEvents)
      .where(sql`${mealEvents.eateryId} = 3 and ${mealEvents.serviceDate} = '2026-11-23' and ${mealEvents.meal} = 'Dinner'`);
    expect(northStar[0].notices).toEqual(["Create: Closed"]);
  });

  it("detects a changed menu and a cancelled meal", async () => {
    const snap = snapshot();
    await ingestSnapshot(db, snap, new Date("2026-11-20T23:00:00Z"));

    const next = structuredClone(snap);
    const morrison = next.data.eateries.find((e) => e.id === 43)!;
    const day = morrison.operatingHours[1];
    const chefsTable = day.events[0].menu.find((c) => classifyStation(c.category).kind === "main")!;
    chefsTable.items.push({ item: "Brand New Test Dish", healthy: false, sortIdx: 99 });
    const cancelled = day.events.pop()!;

    const stats = await ingestSnapshot(db, next, new Date("2026-11-21T00:00:00Z"));
    expect(stats.events.changed).toBe(1);
    expect(stats.events.removed).toBe(1);
    expect(stats.foods.new).toBe(1);
    expect(stats.researchJobsQueued).toBe(isMealInScope(day.events[0].descr) ? 1 : 0);

    const gone = await db
      .select()
      .from(mealEvents)
      .where(sql`${mealEvents.eateryId} = 43 and ${mealEvents.startsAt} = ${new Date(cancelled.startTimestamp * 1000).toISOString()}`);
    expect(gone).toHaveLength(0);
  });
});
