/**
 * Check gluten-free ratings against Cornell's labels (blind: name + café only).
 *   npm run eval:gluten -- [--n 100] [--seed 3]
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { parseArgs } from "node:util";
import { closeDb, getDb } from "@/lib/db/client";
import { netnutritionItems } from "@/lib/db/schema";
import { GF_RATINGS, rateGlutenFree, type GfRating } from "@/lib/research/gluten";
import { costUsd } from "@/lib/research/llm";
import { officialTruth } from "@/lib/research/official";
import { buildIndex } from "@/lib/research/retrieve";

async function main() {
  const { values: a } = parseArgs({ options: { n: { type: "string", default: "100" }, seed: { type: "string", default: "3" } } });
  const rows = await getDb().select().from(netnutritionItems);
  await closeDb();
  const byName = new Map<string, typeof rows>();
  for (const r of rows) byName.set(r.nameKey, [...(byName.get(r.nameKey) ?? []), r]);
  let s = Number(a.seed);
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31), s / 2 ** 31);
  const gold = [...byName.values()]
    .map((labels) => ({ labels, truth: officialTruth(labels) }))
    .filter((g) => g.truth)
    .sort(() => rand() - 0.5)
    .slice(0, Number(a.n));
  const search = buildIndex(rows);

  const table: Record<"gluten" | "no_gluten", Record<GfRating, number>> = {
    gluten: { definitely: 0, likely: 0, less_likely: 0, unlikely: 0 },
    no_gluten: { definitely: 0, likely: 0, less_likely: 0, unlikely: 0 },
  };
  const misses: string[] = [];
  let spent = 0;
  const queue = [...gold];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let g = queue.shift(); g; g = queue.shift()) {
        const name = g.labels[0].name;
        const refs = search(name, 3, g.labels[0].nameKey).map((r) => ({ name: r.name, contains: r.hasContainsLine ? r.containsRaw : null }));
        const r = await rateGlutenFree({ name, servedAt: [g.labels[0].unitName], references: refs });
        spent += costUsd(r.model, r.usage);
        const hasGluten = g.truth!.has("gluten");
        table[hasGluten ? "gluten" : "no_gluten"][r.rating]++;
        if (hasGluten && (r.rating === "definitely" || r.rating === "likely")) misses.push(`${name}: rated ${r.rating} ("${r.reason}")`);
      }
    }),
  );
  console.log(`| Cornell label | ${GF_RATINGS.join(" | ")} |\n|---|---|---|---|---|`);
  for (const k of ["gluten", "no_gluten"] as const) console.log(`| ${k === "gluten" ? "contains gluten" : "no gluten"} | ${GF_RATINGS.map((x) => table[k][x]).join(" | ")} |`);
  console.log(`\nRated GF definitely/likely but Cornell lists gluten (${misses.length}):`);
  misses.forEach((m) => console.log(`- ${m}`));
  console.log(`\nspend: $${spent.toFixed(2)}`);
}

main().catch((e) => ((process.exitCode = 1), console.error(e)));
