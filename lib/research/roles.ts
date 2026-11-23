/**
 * Classify what each food is on a plate (main dish vs side, sauce, …) so we can say whether a
 * hall has real meal options for someone's restrictions — not just rice and toppings.
 * Batched: ~25 foods per call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { foods, menuItems, stations, type FoodRole } from "@/lib/db/schema";
import { RESEARCH_MODEL } from "./config";
import { costUsd } from "./llm";

export const ROLES = ["main", "side", "sauce", "dessert", "drink", "other"] as const satisfies readonly FoodRole[];

const SYSTEM = `You classify items on a university dining hall menu by the role they play in a meal.

Roles:
- "main": a dish that can be the center of a meal on its own: entrées, proteins, pasta dishes, pizza, sandwiches, burgers, stir-fries, curries, hearty soups and chilis served as a meal, composed bowls, main-dish salads, and at breakfast eggs, omelets, pancakes, waffles, French toast, breakfast sandwiches and burritos.
- "side": accompaniments: plain rice and grains, vegetables, potatoes, beans served as a side, bread and rolls, side salads, fruit, light soups served alongside a meal.
- "sauce": sauces, dressings, condiments, relishes, salsas, toppings, garnishes, bars of toppings.
- "dessert": sweets and baked desserts.
- "drink": beverages.
- "other": anything else, including service notes and unnamed specials ("Chef's Choice").

Use the station name as context (a "Sides" station holds sides). Classify every item; return one entry per number.`;

const Schema = z.object({
  items: z.array(z.object({ n: z.number().describe("the item's number from the list"), role: z.enum(ROLES) })),
});

let client: Anthropic | undefined;

export async function classifyRoles(list: { name: string; station: string }[], model = RESEARCH_MODEL) {
  const res = await (client ??= new Anthropic({ maxRetries: 4 })).beta.messages.parse({
    model,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: list.map((x, i) => `${i + 1}. ${x.name} (station: ${x.station})`).join("\n") }],
  });
  if (!res.parsed_output) throw new Error(`role classification failed (${res.stop_reason})`);
  const roles = new Map<number, FoodRole>(res.parsed_output.items.map((x) => [x.n - 1, x.role]));
  const usage = {
    input: res.usage.input_tokens,
    output: res.usage.output_tokens,
    cacheRead: res.usage.cache_read_input_tokens ?? 0,
    cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
  };
  return { roles, cost: costUsd(res.model, usage) };
}

/** Classify foods on in-scope menus that have no role yet. */
export async function runRoleBackfill(db: DB, opts: { ids?: number[]; limit?: number; batch?: number; concurrency?: number; log?: (m: string) => void; classify?: typeof classifyRoles } = {}) {
  const log = opts.log ?? (() => {});
  const classify = opts.classify ?? classifyRoles;
  // One station per food (the most common one) is enough context.
  const rows = await db
    .select({ id: foods.id, name: foods.displayName, station: sql<string>`mode() within group (order by ${stations.name})` })
    .from(foods)
    .innerJoin(menuItems, eq(menuItems.foodId, foods.id))
    .innerJoin(stations, eq(stations.id, menuItems.stationId))
    .where(and(isNull(foods.role), eq(stations.inScope, true), opts.ids ? inArray(foods.id, opts.ids.length ? opts.ids : [-1]) : undefined))
    .groupBy(foods.id, foods.displayName)
    .limit(opts.limit ?? 1000);

  const size = opts.batch ?? 25;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  const stats = { classified: 0, failed: 0, costUsd: 0 };
  await Promise.all(
    Array.from({ length: opts.concurrency ?? 4 }, async () => {
      for (let c = chunks.shift(); c; c = chunks.shift()) {
        try {
          const { roles, cost } = await classify(c.map((r) => ({ name: r.name, station: r.station })));
          stats.costUsd += cost;
          for (const [i, role] of roles) {
            if (!c[i]) continue;
            await db.update(foods).set({ role }).where(eq(foods.id, c[i].id));
            stats.classified++;
            log(`${role.padEnd(7)} ${c[i].name}`);
          }
        } catch (e) {
          stats.failed += c.length;
          log(`! batch failed: ${(e as Error).message}`);
        }
      }
    }),
  );
  return stats;
}

