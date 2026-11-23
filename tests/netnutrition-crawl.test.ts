import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { netnutritionItems } from "@/lib/db/schema";
import { crawlNetNutrition, type CrawledItem } from "@/lib/cornell/netnutrition";
import { saveNetNutrition } from "@/lib/netnutrition/sync";
import { testDb } from "./helpers/db";
import { labelHtml } from "./fixtures";

const noSleep = async () => {};
const HOME = `<a onclick="NetNutrition.UI.unitsSelectUnit(1)">Unit A</a><a onclick="NetNutrition.UI.unitsSelectUnit(2)">Unit B</a>`;
const listing = (oids: number[]) =>
  JSON.stringify({
    panels: [{ html: oids.map((o) => `<a onclick="NetNutrition.UI.getItemNutritionLabelOnClick(event, ${o})">Item ${o}</a>`).join("") }],
  });

/** Fake NetNutrition server. `fail(path, n)` decides whether the n-th call fails. */
function fakeServer(fail: (path: string, n: number) => "ok" | "timeout" | 500 = () => "ok") {
  const calls: string[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    const mode = fail(path, calls.length);
    if (mode === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (mode === 500) return new Response("err", { status: 500 });
    const body = String(init?.body ?? "");
    if (path.endsWith("/SelectUnitFromUnitsList")) return new Response(listing(body.includes("unitOid=1") ? [11, 12] : [21]));
    if (path.endsWith("/ShowItemNutritionLabel")) return new Response(labelHtml());
    return new Response(HOME, { headers: { "set-cookie": "ASP.NET_SessionId=abc; path=/" } });
  }) as typeof fetch;
  return { impl, calls };
}

describe("crawlNetNutrition resilience", () => {
  it("crawls everything on a healthy server", async () => {
    const s = fakeServer();
    const r = await crawlNetNutrition({ base: "https://nn.test/NetNutrition/1", fetch: s.impl, sleep: noSleep, delayMs: 0 });
    expect(r.aborted).toBe(false);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => i.detailOid).sort()).toEqual([11, 12, 21]);
    expect(r.items[0].allergens).toContain("sesame");
  });

  it("retries transient failures and still succeeds", async () => {
    let failed = 0;
    const s = fakeServer((p) => (p.endsWith("/ShowItemNutritionLabel") && failed++ < 2 ? "timeout" : "ok"));
    const r = await crawlNetNutrition({ base: "https://nn.test/NetNutrition/1", fetch: s.impl, sleep: noSleep, delayMs: 0 });
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(3);
  });

  it("trips the circuit breaker instead of hammering a dead server", async () => {
    // Healthy for the home page + first unit listing, then everything times out.
    const s = fakeServer((_p, n) => (n <= 3 ? "ok" : "timeout"));
    const r = await crawlNetNutrition({
      base: "https://nn.test/NetNutrition/1",
      fetch: s.impl,
      sleep: noSleep,
      delayMs: 0,
      maxConsecutiveFailures: 2,
      retries: 1,
    });
    expect(r.aborted).toBe(true);
    // 2 logical failures × (1 try + 1 retry) after the 3 healthy calls; nothing after the breaker opens.
    expect(s.calls.length).toBe(3 + 2 * 2);
  });
});

describe("saveNetNutrition pruning guard", () => {
  let db: DB;
  let close: () => Promise<void>;
  beforeEach(async () => ({ db, close } = await testDb()));
  afterEach(async () => close());

  const item = (oid: number): CrawledItem => ({
    detailOid: oid,
    unitName: "U",
    listedName: `Item ${oid}`,
    name: `Item ${oid}`,
    servingSize: null,
    ingredients: null,
    hasContainsLine: true,
    containsRaw: ["Milk"],
    allergens: ["milk"],
    unmappedAllergens: [],
  });
  const many = (from: number, n: number) => Array.from({ length: n }, (_, i) => item(from + i));
  const total = async () => (await db.select({ c: count() }).from(netnutritionItems))[0].c;

  it("prunes stale labels only after a complete clean crawl", async () => {
    await saveNetNutrition(db, { units: 1, items: many(1, 150), errors: [], aborted: false }, new Date("2026-11-01"));
    expect(await total()).toBe(150);

    // Partial (aborted) crawl that only saw 120 items: keep the other 30.
    const partial = await saveNetNutrition(db, { units: 1, items: many(1, 120), errors: ["x"], aborted: true }, new Date("2026-11-08"));
    expect(partial.prunedSkipped).toBe(true);
    expect(await total()).toBe(150);

    // Clean crawl: items 1..120 still exist, 121..150 are really gone.
    const clean = await saveNetNutrition(db, { units: 1, items: many(1, 120), errors: [], aborted: false }, new Date("2026-11-15"));
    expect(clean.pruned).toBe(30);
    expect(await total()).toBe(120);
  });
});
