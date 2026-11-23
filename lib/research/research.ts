/**
 * Per-food research pipeline (ARCHITECTURE.md §6.4 Steps 0, 3–5).
 */
import { applyFloor, applyMeatRule, type FloorHit } from "@/lib/allergens/keyword-floor";
import { applyConsistency, mergeProfiles, unknownProfile, type AllergenProfileData, type AssessedAllergen } from "@/lib/allergens/status";
import { isPlaceholderName } from "@/lib/ingest/normalize";
import { RESEARCH_EFFORT, RESEARCH_MODEL, RESEARCH_SAMPLES } from "./config";
import { researchOnce, type LlmResult, type Usage } from "./llm";
import type { ResearchInput } from "./prompt";
import { toProfileData, type ResearchOutput } from "./schema";

export type ResearchResult = {
  kind: "researched" | "placeholder" | "not_food";
  /** Final profile: merged runs + keyword floor + consistency. */
  profile: AllergenProfileData;
  /** Merged model output before the deterministic layers (kept for evals/audits). */
  modelOnly: AllergenProfileData | null;
  runs: ResearchOutput[];
  models: string[];
  hardDisagreements: AssessedAllergen[];
  floorHits: FloorHit[];
  usage: Usage;
};

const zeroUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

export type ResearchOptions = {
  model?: string;
  effort?: typeof RESEARCH_EFFORT;
  samples?: number;
  /** Inject a call (tests, eval cache). Defaults to the real API. */
  call?: (input: ResearchInput, sample: number) => Promise<LlmResult>;
};

/** Deterministic post-processing shared by research and evals. */
export function finalize(modelProfile: AllergenProfileData, name: string): { profile: AllergenProfileData; floorHits: FloorHit[] } {
  const { profile: floored, hits } = applyFloor(modelProfile, name, "name");
  return { profile: applyConsistency(applyMeatRule(floored, name)), floorHits: hits };
}

export async function researchFood(input: ResearchInput, opts: ResearchOptions = {}): Promise<ResearchResult> {
  if (isPlaceholderName(input.name)) {
    // No model call (the dish changes daily), but the name still says a lot: "Chef's Choice Pasta"
    // certainly has gluten, "Assorted Cheese Pizza" milk. The keyword floor catches those.
    const { profile, floorHits } = finalize(unknownProfile("changes day to day; check the station"), input.name);
    return { kind: "placeholder", profile, modelOnly: null, runs: [], models: [], hardDisagreements: [], floorHits, usage: zeroUsage() };
  }

  const samples = Math.max(1, opts.samples ?? RESEARCH_SAMPLES);
  const call = opts.call ?? ((i: ResearchInput) => researchOnce(i, { model: opts.model ?? RESEARCH_MODEL, effort: opts.effort }));
  const results = await Promise.all(Array.from({ length: samples }, (_, s) => call(input, s)));
  const runs = results.map((r) => r.output);
  const usage = results.map((r) => r.usage).reduce(addUsage, zeroUsage());
  const models = [...new Set(results.map((r) => r.model))];

  if (runs.some((r) => !r.is_food)) {
    return { kind: "not_food", profile: unknownProfile("not a food item"), modelOnly: null, runs, models, hardDisagreements: [], floorHits: [], usage };
  }
  if (runs.some((r) => r.is_placeholder)) {
    // Still apply the floor: "Assorted Cheese Pizza" placeholder still certainly has milk.
    const { profile, floorHits } = finalize(unknownProfile("name does not identify a specific dish"), input.name);
    return { kind: "placeholder", profile, modelOnly: null, runs, models, hardDisagreements: [], floorHits, usage };
  }

  const merged = mergeProfiles(runs.map(toProfileData));
  const { profile, floorHits } = finalize(merged.profile, input.name);
  return { kind: "researched", profile, modelOnly: merged.profile, runs, models, hardDisagreements: merged.hardDisagreements, floorHits, usage };
}
