/**
 * Resolve the profile a dining-hall item is shown with (ARCHITECTURE.md §4.3).
 *
 *  1. AI research profile (or all-unknown if not researched yet)
 *  2. + Cornell official label for the same name: can only ADD caution (retail café recipes
 *     can differ from dining halls), but where both say free the source upgrades to "official"
 *  3. + hall/station policies: Cornell certifications that make specific allergens absent
 */
import { ASSESSED_ALLERGENS, SEVERITY, type AssessedAllergen, type Assertion, type DietAnswer, type Status } from "./status";

export type Source = "ai" | "official" | "policy" | "none";
export type ResolvedAssertion = Assertion & { source: Source };
export type Resolved = {
  allergens: Record<AssessedAllergen, ResolvedAssertion>;
  diets: { vegetarian: DietAnswer; vegan: DietAnswer };
  placeholder: boolean;
  fried: boolean;
  researched: boolean;
  likelyIngredients: string[];
};

export type StoredProfile = {
  allergens: Record<string, Assertion>;
  diets: { vegetarian?: DietAnswer; vegan?: DietAnswer } | null;
  flags: { kind?: string; fried?: boolean } | null;
  likelyIngredients: string[] | null;
};

/** Cornell certifications, each from a current Cornell page (ARCHITECTURE.md §1.3). */
type Policy = { eateryId?: number; station?: RegExp; free: AssessedAllergen[]; why: string };
export const POLICIES: Policy[] = [
  { eateryId: 4, free: ["gluten", "wheat", "peanuts", "tree_nuts"], why: "Risley is certified gluten-, peanut- and tree-nut-free" },
  { eateryId: 31, free: ["pork", "shellfish"], why: "104West! is Star-K certified kosher" },
  { station: /^halal$/i, free: ["pork", "alcohol"], why: "Halal station" },
  { station: /kosher/i, free: ["pork", "shellfish"], why: "Kosher station" },
];

export function resolve(ai: StoredProfile | null, official: StoredProfile | null, ctx: { eateryId: number; station: string }): Resolved {
  const allergens = {} as Resolved["allergens"];
  for (const a of ASSESSED_ALLERGENS) {
    let cur: ResolvedAssertion = ai?.allergens[a]
      ? { ...ai.allergens[a], source: "ai" }
      : { status: "unknown", confidence: 0, reason: ai ? "" : "not researched yet", source: "none" };
    const off = official?.allergens[a];
    if (off) {
      if (SEVERITY[off.status as Status] > SEVERITY[cur.status]) cur = { ...off, source: "official" };
      else if (off.status === "free" && cur.status === "free") cur = { ...off, source: "official" };
    }
    allergens[a] = cur;
  }
  for (const p of POLICIES) {
    if ((p.eateryId !== undefined && p.eateryId !== ctx.eateryId) || (p.station && !p.station.test(ctx.station))) continue;
    for (const a of p.free) allergens[a] = { status: "free", confidence: 1, reason: p.why, source: "policy" };
  }
  return {
    allergens,
    diets: { vegetarian: ai?.diets?.vegetarian ?? "unsure", vegan: ai?.diets?.vegan ?? "unsure" },
    placeholder: ai?.flags?.kind === "placeholder" || ai?.flags?.kind === "not_food",
    fried: !!ai?.flags?.fried,
    researched: !!ai,
    likelyIngredients: ai?.likelyIngredients ?? [],
  };
}
