/**
 * Resolve the profile a dining-hall item is shown with (ARCHITECTURE.md §4.3).
 *
 *  1. AI research profile (or all-unknown if not researched yet)
 *  2. + Cornell official label for the same name: can only ADD caution (retail café recipes
 *     can differ from dining halls), but where both say free the source upgrades to "official"
 *  3. + hall/station policies: Cornell certifications that make specific allergens absent
 */
import { ASSESSED_ALLERGENS, SEVERITY, type AssessedAllergen, type Assertion, type DietAnswer, type Status } from "./status";

export type GfRating = "definitely" | "likely" | "less_likely" | "unlikely";

export type Source = "ai" | "official" | "policy" | "none";
export type ResolvedAssertion = Assertion & { source: Source };
export type Resolved = {
  allergens: Record<AssessedAllergen, ResolvedAssertion>;
  diets: { vegetarian: DietAnswer; vegan: DietAnswer };
  placeholder: boolean;
  fried: boolean;
  researched: boolean;
  likelyIngredients: string[];
  /** How likely the dish is gluten-free by recipe (cross-contact ignored). null = can't say. */
  gf: { rating: GfRating; reason: string; source: Source } | null;
};

export type StoredProfile = {
  allergens: Record<string, Assertion>;
  diets: { vegetarian?: DietAnswer; vegan?: DietAnswer } | null;
  flags: { kind?: string; fried?: boolean; gf?: { rating: GfRating; reason: string } | null } | null;
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
    gf: glutenFree(ai, official, allergens),
    diets: { vegetarian: ai?.diets?.vegetarian ?? "unsure", vegan: ai?.diets?.vegan ?? "unsure" },
    placeholder: ai?.flags?.kind === "placeholder" || ai?.flags?.kind === "not_food",
    fried: !!ai?.flags?.fried,
    researched: !!ai,
    likelyIngredients: ai?.likelyIngredients ?? [],
  };
}

/** Certification > Cornell label > recipe estimate > fallback from the gluten status. */
function glutenFree(ai: StoredProfile | null, official: StoredProfile | null, allergens: Resolved["allergens"]): Resolved["gf"] {
  const g = allergens.gluten;
  if (g.source === "policy") return { rating: "definitely", reason: g.reason, source: "policy" };
  const off = official?.allergens.gluten?.status;
  if (off === "contains") return { rating: "unlikely", reason: "Cornell's label lists gluten", source: "official" };
  if (off === "free") return { rating: "definitely", reason: "Cornell's label lists no gluten", source: "official" };
  if (!ai || ai.flags?.kind === "not_food") return null;
  const glutenEvidence = g.status === "contains" ? `contains ${(g.reason.match(/"([^"]+)"/)?.[1] ?? g.reason) || "gluten"}` : "";
  // Rotating items ("Chef's Choice Pasta"): only the name is known. Say "unlikely" when it names gluten.
  if (ai.flags?.kind === "placeholder") return g.status === "contains" ? { rating: "unlikely", reason: glutenEvidence, source: "ai" } : null;
  if (ai.flags?.gf) {
    // Safety net: research found gluten in the recipe, so a "definitely/likely" rating can't stand.
    const confident = ai.flags.gf.rating === "definitely" || ai.flags.gf.rating === "likely";
    if (g.status === "contains" && confident) return { rating: "less_likely", reason: glutenEvidence, source: "ai" };
    return { ...ai.flags.gf, source: "ai" };
  }
  const fallback: Partial<Record<Status, GfRating>> = { contains: "unlikely", may_contain: "less_likely", free: "likely" };
  const rating = fallback[g.status];
  return rating ? { rating, reason: g.reason, source: "ai" } : null;
}
