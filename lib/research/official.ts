/**
 * Official Cornell profile from NetNutrition labels (ARCHITECTURE.md §6.4 Step 1).
 *
 * - Union across ALL labels with the same name (recipes differ by café).
 * - Only labels WITH a "Contains:" line are authoritative; absent allergens on those labels are `free`.
 * - Labels without a Contains line contribute their ingredients through the keyword floor
 *   (Cornell's "Sour Cream" label has no Contains line but lists milk).
 */
import { applyFloor } from "@/lib/allergens/keyword-floor";
import {
  applyConsistency,
  ASSESSED_ALLERGENS,
  unknownProfile,
  type AllergenProfileData,
  type AssessedAllergen,
} from "@/lib/allergens/status";
import { TREE_NUT_SUBTYPES, type Allergen } from "@/lib/allergens/taxonomy";

export type OfficialLabel = { hasContainsLine: boolean; allergens: string[]; ingredients: string | null; unitName: string };

export function officialProfile(labels: OfficialLabel[]): AllergenProfileData | null {
  const authoritative = labels.filter((l) => l.hasContainsLine);
  if (!authoritative.length) return null; // no official allergen statement at all → not an official profile

  const present = new Set<Allergen>(authoritative.flatMap((l) => l.allergens as Allergen[]));
  const where = (a: Allergen) => authoritative.filter((l) => l.allergens.includes(a)).map((l) => l.unitName);

  const p = unknownProfile("");
  for (const a of ASSESSED_ALLERGENS) {
    p.allergens[a] = present.has(a)
      ? { status: "contains", confidence: 1, reason: `Cornell label (${[...new Set(where(a))].join(", ")})` }
      : { status: "free", confidence: 1, reason: "" };
  }
  p.treeNutTypes = TREE_NUT_SUBTYPES.filter((t) => present.has(t));
  p.diets = { vegetarian: "unsure", vegan: "unsure" };

  // Labels WITH a Contains line are Cornell's explicit statement — trust them as written (the floor
  // would otherwise e.g. turn "soy lecithin" into "contains soy" against Cornell's own labeling).
  // Labels WITHOUT one only have ingredients; those can add allergens via the floor.
  let out = p;
  for (const l of labels) {
    if (!l.hasContainsLine && l.ingredients) out = applyFloor(out, l.ingredients, `ingredients @ ${l.unitName}`).profile;
  }
  return applyConsistency(out);
}

/** Allergens Cornell's labels assert for a gold-set item (eval ground truth). */
export function officialTruth(labels: OfficialLabel[]): Set<AssessedAllergen> | null {
  const authoritative = labels.filter((l) => l.hasContainsLine);
  if (!authoritative.length) return null;
  const truth = new Set<AssessedAllergen>();
  for (const l of authoritative)
    for (const a of l.allergens) {
      if ((ASSESSED_ALLERGENS as readonly string[]).includes(a)) truth.add(a as AssessedAllergen);
      if ((TREE_NUT_SUBTYPES as readonly string[]).includes(a)) truth.add("tree_nuts");
    }
  return truth;
}
