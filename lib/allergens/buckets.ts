/**
 * Compact item codes + the three user-facing buckets (ARCHITECTURE.md §4.4).
 * Pure and dependency-light: runs in the browser, so diet preferences never leave the device.
 */
import type { Resolved } from "./resolve";
import { ASSESSED_ALLERGENS, type AssessedAllergen } from "./status";

/**
 * One char per allergen, in ASSESSED_ALLERGENS order:
 *   C contains · M may contain · U unknown · V free, verified (Cornell label / policy)
 *   A free, AI high confidence · L free, AI low confidence
 */
export type Code = string;
export const FITS_CONFIDENCE = 0.8;

export type CompactItem = {
  id: number;
  name: string;
  code: Code;
  /** vegetarian, vegan: y / n / u */
  diet: string;
  placeholder?: boolean;
  fried?: boolean;
};

export function encode(r: Resolved): { code: Code; diet: string } {
  const code = ASSESSED_ALLERGENS.map((a) => {
    const x = r.allergens[a];
    if (x.status === "contains") return "C";
    if (x.status === "may_contain") return "M";
    if (x.status === "unknown") return "U";
    if (x.source === "official" || x.source === "policy") return "V";
    return x.confidence >= FITS_CONFIDENCE ? "A" : "L";
  }).join("");
  const d = (v: string) => (v === "yes" ? "y" : v === "no" ? "n" : "u");
  return { code, diet: d(r.diets.vegetarian) + d(r.diets.vegan) };
}

export type Diet = "vegetarian" | "vegan";
export type Prefs = { avoid: AssessedAllergen[]; diets: Diet[]; strict: boolean };
export type Bucket = "fits" | "check" | "avoid";
export type Verdict = { bucket: Bucket; notes: string[] };

export const LABEL: Record<AssessedAllergen, string> = {
  milk: "milk",
  egg: "egg",
  fish: "fish",
  shellfish: "shellfish",
  peanuts: "peanuts",
  tree_nuts: "tree nuts",
  soy: "soy",
  sesame: "sesame",
  wheat: "wheat",
  gluten: "gluten",
  coconut: "coconut",
  pork: "pork",
  alcohol: "alcohol",
};

export function verdict(item: CompactItem, prefs: Prefs): Verdict {
  const avoid: string[] = [];
  const check: string[] = [];
  for (const a of prefs.avoid) {
    const c = item.code[ASSESSED_ALLERGENS.indexOf(a)];
    if (c === "C") avoid.push(`Contains ${LABEL[a]}`);
    else if (c === "M") check.push(`May contain ${LABEL[a]}`);
    else if (c === "U") check.push(`${cap(LABEL[a])} unknown`);
    else if (c === "L") check.push(`${cap(LABEL[a])} not confirmed`);
    else if (c === "A" && prefs.strict) check.push(`${cap(LABEL[a])} not verified by Cornell`);
  }
  for (const d of prefs.diets) {
    const v = item.diet[d === "vegetarian" ? 0 : 1];
    if (v === "n") avoid.push(`Not ${d}`);
    else if (v === "u") check.push(`Check if ${d}`);
  }
  if (item.placeholder && (prefs.avoid.length || prefs.diets.length)) check.unshift("Varies day to day");
  if (avoid.length) return { bucket: "avoid", notes: avoid };
  if (check.length) return { bucket: "check", notes: check };
  return { bucket: "fits", notes: [] };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
