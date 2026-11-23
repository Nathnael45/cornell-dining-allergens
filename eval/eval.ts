/**
 * Evaluate allergen research against Cornell's official NetNutrition labels (ARCHITECTURE.md §9).
 *
 *   npm run eval -- --model claude-sonnet-5-5 --n 100 [--samples 2] [--effort high] [--seed 1]
 *
 * The model sees only the dish name + café (never the graded label). Raw model answers are cached
 * in eval/.cache, so re-scoring is free. Headline metric: FALSE-SAFE — Cornell says it contains X
 * but we'd show "fits" (free, confidence ≥ 0.8) to someone avoiding X.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "@/lib/db/client";
import { netnutritionItems } from "@/lib/db/schema";
import { ASSESSED_ALLERGENS, mergeProfiles, type AllergenProfileData, type AssessedAllergen } from "@/lib/allergens/status";
import { costUsd, researchOnce, type LlmResult } from "@/lib/research/llm";
import { PROMPT_VERSION, type ResearchInput } from "@/lib/research/prompt";
import { finalize } from "@/lib/research/research";
import { buildIndex, tokens } from "@/lib/research/retrieve";
import { toProfileData } from "@/lib/research/schema";
import { officialTruth } from "@/lib/research/official";

export const FITS_CONFIDENCE = 0.8;

// ---------------------------------------------------------------- scoring (pure)

type Stats = { pos: number; unsafe: number; hit: number; neg: number; fits: number; overC: number; overM: number };
const empty = (): Stats => ({ pos: 0, unsafe: 0, hit: 0, neg: 0, fits: 0, overC: 0, overM: 0 });

export function score(items: { name: string; truth: Set<AssessedAllergen>; profile: AllergenProfileData }[]) {
  const per = Object.fromEntries(ASSESSED_ALLERGENS.map((a) => [a, empty()])) as Record<AssessedAllergen, Stats>;
  const all = empty();
  const cases: string[] = [];
  for (const it of items)
    for (const a of ASSESSED_ALLERGENS) {
      const { status, confidence, reason } = it.profile.allergens[a];
      const fits = status === "free" && confidence >= FITS_CONFIDENCE;
      const inc = (k: keyof Stats) => {
        per[a][k]++;
        all[k]++;
      };
      if (it.truth.has(a)) {
        inc("pos");
        if (status === "contains") inc("hit");
        if (fits) {
          inc("unsafe");
          cases.push(`${it.name} — ${a} (model: free @${confidence.toFixed(2)}${reason ? `, "${reason}"` : ""})`);
        }
      } else {
        inc("neg");
        if (fits) inc("fits");
        if (status === "contains") inc("overC");
        if (status === "may_contain" || status === "unknown") inc("overM");
      }
    }
  return { per, all, cases };
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");

function table(title: string, r: ReturnType<typeof score>) {
  const row = (name: string, s: Stats) =>
    `| ${name} | ${s.pos} | ${s.unsafe} (${pct(s.unsafe, s.pos)}) | ${pct(s.hit, s.pos)} | ${pct(s.fits, s.neg)} | ${pct(s.overC, s.neg)} | ${pct(s.overM, s.neg)} |`;
  return [
    `#### ${title}`,
    "| allergen | Cornell: contains | **false-safe** | recall (contains) | correctly shown as fits | over-flag: contains | over-flag: may/unknown |",
    "|---|---|---|---|---|---|---|",
    ...ASSESSED_ALLERGENS.map((a) => row(a, r.per[a])),
    row("**all**", r.all),
  ].join("\n");
}

// ---------------------------------------------------------------- run

function rng(seed: number) {
  return () => ((seed = (seed + 0x6d2b79f5) | 0), ((Math.imul(seed ^ (seed >>> 15), 1 | seed) >>> 0) % 1e9) / 1e9);
}

async function main() {
  const { values: a } = parseArgs({
    options: {
      model: { type: "string", default: process.env.RESEARCH_MODEL ?? "claude-sonnet-5-5" },
      effort: { type: "string", default: "high" },
      n: { type: "string", default: "100" },
      samples: { type: "string", default: "2" },
      seed: { type: "string", default: "1" },
      per: { type: "string", default: "5" }, // positives per allergen guaranteed in the sample
      "exclude-seed": { type: "string" },
      concurrency: { type: "string", default: "4" },
    },
  });
  const model = a.model!;
  const effort = a.effort as "low" | "medium" | "high";
  const samples = Number(a.samples);

  // Gold set: one entry per dish name, truth = union of Contains lines (labels without one are ignored).
  const rows = await getDb().select().from(netnutritionItems);
  await closeDb();
  const byName = new Map<string, typeof rows>();
  for (const r of rows) byName.set(r.nameKey, [...(byName.get(r.nameKey) ?? []), r]);
  const gold = [...byName.values()]
    .map((labels) => ({ labels, truth: officialTruth(labels) }))
    .filter((g): g is { labels: typeof rows; truth: Set<AssessedAllergen> } => g.truth !== null);

  // Stratified sample: a few positives for every allergen (rare ones too), then random fill.
  // --exclude-seed S removes the dishes seed S would pick, giving a held-out set for prompt changes.
  const pick = (seed: number, pool: typeof gold) => {
    const rand = rng(seed);
    const shuffled = [...pool].sort(() => rand() - 0.5);
    const picked = new Set<(typeof gold)[number]>();
    for (const al of ASSESSED_ALLERGENS) shuffled.filter((g) => g.truth.has(al)).slice(0, Number(a.per)).forEach((g) => picked.add(g));
    for (const g of shuffled) if (picked.size < Number(a.n)) picked.add(g);
    return [...picked]; // ≥ n when stratification needs more to cover rare allergens
  };
  const excluded = new Set(a["exclude-seed"] ? pick(Number(a["exclude-seed"]), gold) : []);
  const sample = pick(Number(a.seed), gold.filter((g) => !excluded.has(g)));

  const search = buildIndex(rows);
  const cacheDir = `eval/.cache/${model}/${effort}/${PROMPT_VERSION}`;
  mkdirSync(cacheDir, { recursive: true });
  let spent = 0;
  let calls = 0;

  async function call(input: ResearchInput, key: string, s: number): Promise<LlmResult> {
    const f = `${cacheDir}/${key.replace(/[^a-z0-9]+/g, "_")}.${s}.json`;
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
    const r = await researchOnce(input, { model, effort });
    writeFileSync(f, JSON.stringify(r));
    spent += costUsd(model, r.usage);
    calls++;
    return r;
  }

  const results: { name: string; truth: Set<AssessedAllergen>; single: AllergenProfileData; merged: AllergenProfileData; final: AllergenProfileData }[] = [];
  const queue = [...sample];
  let done = 0;
  await Promise.all(
    Array.from({ length: Number(a.concurrency) }, async () => {
      for (let g = queue.shift(); g; g = queue.shift()) {
        const name = g.labels[0].name;
        const qTokens = new Set(tokens(name));
        // References: similar labels, excluding this dish and near-duplicates (avoid leaking the answer).
        const refs = search(name, 12, g.labels[0].nameKey)
          .filter((r) => {
            const t = new Set(tokens(r.name));
            const inter = [...t].filter((x) => qTokens.has(x)).length;
            return inter / (t.size + qTokens.size - inter) < 0.6;
          })
          .slice(0, 5)
          .map((r) => ({ name: r.name, contains: r.hasContainsLine ? r.containsRaw : null, ingredients: r.ingredients }));
        const input: ResearchInput = {
          name,
          servedAt: [...new Set(g.labels.map((l) => `${l.unitName} (Cornell café)`))],
          siblings: [],
          references: refs,
        };
        try {
          const runs = await Promise.all(Array.from({ length: samples }, (_, s) => call(input, g.labels[0].nameKey, s)));
          const profiles = runs.map((r) => toProfileData(r.output));
          const merged = mergeProfiles(profiles).profile;
          results.push({ name, truth: g.truth, single: profiles[0], merged, final: finalize(merged, name).profile });
        } catch (e) {
          console.error(`  ! ${name}: ${(e as Error).message}`);
        }
        if (++done % 10 === 0) console.error(`  ${done}/${sample.length} · new calls ${calls} · $${spent.toFixed(2)}`);
      }
    }),
  );

  const variants = {
    [`single run (${model})`]: score(results.map((r) => ({ ...r, profile: r.single }))),
    [`${samples} runs merged (${model})`]: score(results.map((r) => ({ ...r, profile: r.merged }))),
    [`${samples} runs merged + keyword floor + consistency (shipped pipeline)`]: score(results.map((r) => ({ ...r, profile: r.final }))),
  };
  const finalCases = Object.values(variants).at(-1)!.cases;
  const md = [
    `## Eval ${new Date().toISOString().slice(0, 10)} · ${model} · effort ${effort} · prompt ${PROMPT_VERSION}`,
    "",
    `${results.length} dishes (seed ${a.seed}${a["exclude-seed"] ? `, held out from seed ${a["exclude-seed"]}` : ""}), ${samples} samples each. "fits" = free with confidence ≥ ${FITS_CONFIDENCE}. New API spend this run: $${spent.toFixed(2)} (${calls} calls).`,
    "",
    ...Object.entries(variants).flatMap(([t, r]) => [table(t, r), ""]),
    `#### False-safe cases in the shipped pipeline (${finalCases.length})`,
    ...(finalCases.length ? finalCases.map((c) => `- ${c}`) : ["- none"]),
  ].join("\n");
  mkdirSync("eval/results", { recursive: true });
  const out = `eval/results/${new Date().toISOString().slice(0, 10)}-${model}-${effort}-p${PROMPT_VERSION.split(".").at(-1)}-seed${a.seed}-n${results.length}.md`;
  writeFileSync(out, md + "\n");
  console.log(md);
  console.error(`\nwrote ${out}`);
}

if (process.argv[1]?.endsWith("eval.ts")) main().catch((e) => ((process.exitCode = 1), console.error(e)));
