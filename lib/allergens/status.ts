/**
 * Allergen assertion model (ARCHITECTURE.md §4.2) and the conservative merge rules.
 */
import { TREE_NUT_SUBTYPES, type Allergen } from "./taxonomy";

export const STATUSES = ["contains", "may_contain", "unknown", "free"] as const;
export type Status = (typeof STATUSES)[number];

/** Higher = more cautious. Merges always keep the most cautious status. */
export const SEVERITY: Record<Status, number> = { free: 0, unknown: 1, may_contain: 2, contains: 3 };

export type Assertion = { status: Status; confidence: number; reason: string };

/** Allergens the research model assesses directly. Tree-nut subtypes are reported as a list. */
export const ASSESSED_ALLERGENS = [
  "milk",
  "egg",
  "fish",
  "shellfish",
  "peanuts",
  "tree_nuts",
  "soy",
  "sesame",
  "wheat",
  "gluten",
  "coconut",
  "pork",
  "alcohol",
] as const satisfies readonly Allergen[];
export type AssessedAllergen = (typeof ASSESSED_ALLERGENS)[number];

export type DietAnswer = "yes" | "no" | "unsure";

export type AllergenProfileData = {
  allergens: Record<AssessedAllergen, Assertion>;
  treeNutTypes: (typeof TREE_NUT_SUBTYPES)[number][];
  diets: { vegetarian: DietAnswer; vegan: DietAnswer };
  likelyIngredients: string[];
  fried: boolean;
};

export const moreCautious = (a: Status, b: Status): Status => (SEVERITY[a] >= SEVERITY[b] ? a : b);

/** Keep the more cautious assertion; on a tie keep the lower confidence (we are only as sure as the least sure run). */
export function mergeAssertion(a: Assertion, b: Assertion): Assertion {
  if (SEVERITY[a.status] !== SEVERITY[b.status]) return SEVERITY[a.status] > SEVERITY[b.status] ? a : b;
  return a.confidence <= b.confidence ? a : b;
}

const DIET_CAUTION: Record<DietAnswer, number> = { yes: 0, unsure: 1, no: 2 };
const mergeDiet = (a: DietAnswer, b: DietAnswer): DietAnswer => (DIET_CAUTION[a] >= DIET_CAUTION[b] ? a : b);

export type MergeResult = {
  profile: AllergenProfileData;
  /** Allergens where one run said `free` and another said `contains` — sent to human review. */
  hardDisagreements: AssessedAllergen[];
};

/** Combine N independent research runs conservatively (ARCHITECTURE.md §6.4 Step 4). */
export function mergeProfiles(runs: AllergenProfileData[]): MergeResult {
  if (!runs.length) throw new Error("mergeProfiles needs at least one run");
  const [first, ...rest] = runs;
  const allergens = { ...first.allergens };
  const hardDisagreements = new Set<AssessedAllergen>();
  for (const r of rest) {
    for (const a of ASSESSED_ALLERGENS) {
      const s = new Set([allergens[a].status, r.allergens[a].status]);
      if (s.has("free") && s.has("contains")) hardDisagreements.add(a);
      allergens[a] = mergeAssertion(allergens[a], r.allergens[a]);
    }
  }
  return {
    profile: {
      allergens,
      treeNutTypes: [...new Set(runs.flatMap((r) => r.treeNutTypes))].sort(),
      diets: {
        vegetarian: runs.map((r) => r.diets.vegetarian).reduce(mergeDiet),
        vegan: runs.map((r) => r.diets.vegan).reduce(mergeDiet),
      },
      likelyIngredients: [...new Set(runs.flatMap((r) => r.likelyIngredients.map((i) => i.toLowerCase().trim())))],
      fried: runs.some((r) => r.fried),
    },
    hardDisagreements: [...hardDisagreements],
  };
}

/** Raise an allergen to at least `status` (never lowers). */
export function raise(p: AllergenProfileData, a: AssessedAllergen, status: Status, reason: string, confidence = 0.9) {
  if (SEVERITY[status] > SEVERITY[p.allergens[a].status]) p.allergens[a] = { status, confidence, reason };
}

/**
 * Structural consistency rules (pure code, only ever raise severity):
 *  - wheat ⇒ gluten; any tree-nut subtype ⇒ tree_nuts
 *  - vegan "yes" is impossible if milk/egg/fish/shellfish/pork are present → vegan "unsure"/"no"
 *  - vegetarian "yes" is impossible with fish/shellfish/pork → "no"
 */
export function applyConsistency(input: AllergenProfileData): AllergenProfileData {
  const p = structuredClone(input);
  raise(p, "gluten", p.allergens.wheat.status, `implied by wheat: ${p.allergens.wheat.reason}`, p.allergens.wheat.confidence);
  if (p.treeNutTypes.length) raise(p, "tree_nuts", "contains", `contains ${p.treeNutTypes.join(", ")}`);

  const animal = (["milk", "egg", "fish", "shellfish", "pork"] as const).map((a) => p.allergens[a].status);
  if (animal.includes("contains")) p.diets.vegan = "no";
  else if (p.diets.vegan === "yes" && animal.includes("may_contain")) p.diets.vegan = "unsure";

  const flesh = (["fish", "shellfish", "pork"] as const).map((a) => p.allergens[a].status);
  if (flesh.includes("contains")) p.diets.vegetarian = "no";
  if (p.diets.vegetarian === "no") p.diets.vegan = "no";
  return p;
}

/** Profile for foods we can't research (placeholders like "Chef's Choice"): everything unknown. */
export function unknownProfile(reason: string): AllergenProfileData {
  const allergens = Object.fromEntries(
    ASSESSED_ALLERGENS.map((a) => [a, { status: "unknown", confidence: 0, reason } satisfies Assertion]),
  ) as Record<AssessedAllergen, Assertion>;
  return { allergens, treeNutTypes: [], diets: { vegetarian: "unsure", vegan: "unsure" }, likelyIngredients: [], fried: false };
}
