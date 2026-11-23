import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { allergenProfiles, foods, netnutritionItems, researchJobs } from "@/lib/db/schema";
import { ASSESSED_ALLERGENS } from "@/lib/allergens/status";
import { ingestSnapshot } from "@/lib/ingest/ingest";
import { nameKey } from "@/lib/ingest/normalize";
import type { LlmResult } from "@/lib/research/llm";
import type { ResearchInput } from "@/lib/research/prompt";
import type { ResearchOutput } from "@/lib/research/schema";
import { runResearchBatch } from "@/lib/research/worker";
import { testDb } from "./helpers/db";
import { snapshot } from "./fixtures";

let db: DB;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await testDb()));
afterEach(async () => close());

/** Fake model: everything free except what the test says; run index decides disagreements. */
function fakeModel(over: (input: ResearchInput, sample: number) => Partial<Record<(typeof ASSESSED_ALLERGENS)[number], "contains" | "free">>) {
  const seen: ResearchInput[] = [];
  const call = async (input: ResearchInput, sample: number): Promise<LlmResult> => {
    seen.push(input);
    const o = over(input, sample);
    const output: ResearchOutput = {
      is_food: true,
      is_placeholder: false,
      likely_ingredients: ["x"],
      allergens: Object.fromEntries(ASSESSED_ALLERGENS.map((a) => [a, { status: o[a] ?? "free", confidence: 0.95, reason: "" }])) as ResearchOutput["allergens"],
      tree_nut_types: [],
      vegetarian: "yes",
      vegan: "yes",
      fried: false,
    };
    return { output, model: "fake", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  };
  return { call, seen };
}

describe("runResearchBatch", () => {
  it("researches queued foods with real context, stores profiles, and routes disagreements to review", async () => {
    await ingestSnapshot(db, snapshot(), new Date("2026-11-20T23:00:00Z"));
    // An official label for one dish that is on the menu.
    await db.insert(netnutritionItems).values({
      detailOid: 1, unitName: "Trillium", name: "Broccoli Cheddar Soup", nameKey: nameKey("Broccoli Cheddar Soup"),
      hasContainsLine: true, containsRaw: ["Milk", "Wheat", "Gluten"], allergens: ["milk", "wheat", "gluten"], unmappedAllergens: [],
    });
    const targets = ["Broccoli Cheddar Soup", "Thai Red Curry Tofu & Vegetables", "Chef's Choice"].map(nameKey);
    // Only work on our three foods: drop every other job.
    const keep = await db.select({ id: foods.id, key: foods.nameKey }).from(foods);
    for (const f of keep) if (!targets.includes(f.key)) await db.delete(researchJobs).where(eq(researchJobs.foodId, f.id));

    // Run 1 says the curry is soy-free, run 2 says it contains soy → hard disagreement.
    const fake = fakeModel((input, s) => (input.name.startsWith("Thai") ? { soy: s === 0 ? "free" : "contains" } : {}));
    const stats = await runResearchBatch(db, { call: fake.call, samples: 2, concurrency: 1 });

    expect(stats).toMatchObject({ claimed: 3, failed: 0, official: 1, needsReview: 1, done: 2 });
    expect(await db.select().from(researchJobs)).toHaveLength(0);

    const soup = fake.seen.find((i) => i.name === "Broccoli Cheddar Soup")!;
    expect(soup.servedAt.length).toBeGreaterThan(0);
    expect(soup.servedAt[0]).toMatch(/station/);
    expect(soup.references[0]?.name).toBe("Broccoli Cheddar Soup");
    expect(fake.seen.some((i) => i.name === "Chef's Choice")).toBe(false); // placeholders never hit the model

    const byKey = async (k: string, source: "ai" | "cornell_official") => {
      const [f] = await db.select().from(foods).where(eq(foods.nameKey, k));
      const [p] = await db.select().from(allergenProfiles).where(and(eq(allergenProfiles.foodId, f.id), eq(allergenProfiles.source, source), eq(allergenProfiles.isCurrent, true)));
      return { f, p: p as typeof p & { allergens: Record<string, { status: string }> } };
    };
    // Fake model said "free" for everything, but the keyword floor still catches cheddar → milk.
    expect((await byKey(nameKey("Broccoli Cheddar Soup"), "ai")).p.allergens.milk.status).toBe("contains");
    expect((await byKey(nameKey("Broccoli Cheddar Soup"), "cornell_official")).p.allergens.wheat.status).toBe("contains");
    const curry = await byKey(nameKey("Thai Red Curry Tofu & Vegetables"), "ai");
    expect(curry.f.researchStatus).toBe("needs_review");
    expect(curry.p.allergens.soy.status).toBe("contains");
    expect((await byKey(nameKey("Chef's Choice"), "ai")).p.allergens.milk.status).toBe("unknown");
  });

  it("records failures and stops retrying after 3 attempts", async () => {
    await ingestSnapshot(db, snapshot(), new Date("2026-11-20T23:00:00Z"));
    const [one] = await db.select().from(researchJobs).limit(1);
    await db.delete(researchJobs).where(sql`food_id <> ${one.foodId}`);
    const boom = async () => {
      throw new Error("API down");
    };
    for (let i = 0; i < 4; i++) await runResearchBatch(db, { call: boom });
    const [job] = await db.select().from(researchJobs);
    expect(job).toMatchObject({ attempts: 3, lastError: "API down" });
    const [f] = await db.select().from(foods).where(eq(foods.id, one.foodId));
    expect(f.researchStatus).toBe("failed");
  });
});

