/**
 * Allergen taxonomy — mirrors exactly what Cornell labels (NetNutrition filters + residential
 * station cards). See ARCHITECTURE.md §1.2–1.3 and §4.1.
 */

export const TREE_NUT_SUBTYPES = ["almond", "hazelnut", "macadamia", "pecan", "pistachio", "walnut"] as const;

export const ALLERGENS = [
  "milk",
  "egg",
  "fish",
  "shellfish",
  "peanuts",
  "tree_nuts",
  ...TREE_NUT_SUBTYPES,
  "soy",
  "sesame",
  "wheat",
  "gluten",
  "coconut",
  "pork",
  "alcohol",
] as const;

export const DIETS = ["vegetarian", "vegan", "halal", "kosher"] as const;

export type Allergen = (typeof ALLERGENS)[number];
export type Diet = (typeof DIETS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "Milk",
  egg: "Egg",
  fish: "Fish",
  shellfish: "Shellfish",
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  almond: "Almonds",
  hazelnut: "Hazelnuts",
  macadamia: "Macadamia nuts",
  pecan: "Pecans",
  pistachio: "Pistachios",
  walnut: "Walnuts",
  soy: "Soy",
  sesame: "Sesame",
  wheat: "Wheat",
  gluten: "Gluten",
  coconut: "Coconut",
  pork: "Pork",
  alcohol: "Alcohol",
};

/** Cornell's printed allergen names (NetNutrition "Contains:" line / filter panel) → our keys. */
const CORNELL_NAME_TO_KEY: Record<string, Allergen> = {
  alcohol: "alcohol",
  almonds: "almond",
  almond: "almond",
  coconut: "coconut",
  egg: "egg",
  eggs: "egg",
  fish: "fish",
  gluten: "gluten",
  "hazelnut and hazelnut products": "hazelnut",
  hazelnut: "hazelnut",
  hazelnuts: "hazelnut",
  "macadamia nut": "macadamia",
  macadamia: "macadamia",
  milk: "milk",
  peanuts: "peanuts",
  peanut: "peanuts",
  "pecan nut": "pecan",
  pecan: "pecan",
  pecans: "pecan",
  pistachio: "pistachio",
  pistachios: "pistachio",
  pork: "pork",
  sesame: "sesame",
  shellfish: "shellfish",
  soy: "soy",
  "tree nuts": "tree_nuts",
  "tree nut": "tree_nuts",
  walnuts: "walnut",
  walnut: "walnut",
  wheat: "wheat",
};

export type MappedAllergens = { allergens: Allergen[]; unmapped: string[] };

/**
 * Map Cornell's printed names to taxonomy keys. Sub-type tree nuts also imply `tree_nuts`,
 * and wheat implies gluten. Unknown names are returned (never silently dropped) so a
 * person can extend the mapping.
 */
export function mapCornellAllergens(names: string[]): MappedAllergens {
  const out = new Set<Allergen>();
  const unmapped: string[] = [];
  for (const raw of names) {
    const key = CORNELL_NAME_TO_KEY[raw.trim().toLowerCase()];
    if (!key) {
      if (raw.trim()) unmapped.push(raw.trim());
      continue;
    }
    out.add(key);
    if ((TREE_NUT_SUBTYPES as readonly string[]).includes(key)) out.add("tree_nuts");
    if (key === "wheat") out.add("gluten");
  }
  return { allergens: ALLERGENS.filter((a) => out.has(a)), unmapped };
}
