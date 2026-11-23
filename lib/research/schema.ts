/**
 * Structured output the research model must return (validated by the SDK via zod).
 * Keep it flat and enum-heavy: easy for the model, easy to validate, cheap in tokens.
 */
import { z } from "zod";
import { ASSESSED_ALLERGENS, STATUSES, type AllergenProfileData } from "@/lib/allergens/status";
import { TREE_NUT_SUBTYPES } from "@/lib/allergens/taxonomy";

const AssertionSchema = z.object({
  status: z.enum(STATUSES),
  confidence: z.number().describe("0 to 1: how sure you are of this status for a typical institutional recipe"),
  reason: z.string().describe("Short, e.g. 'soy sauce in the glaze'. Empty string when status is free and obvious."),
});

export const ResearchOutputSchema = z.object({
  is_food: z.boolean().describe("false for non-food lines like 'Hot & Cold Beverage Service' or 'Closed'"),
  is_placeholder: z
    .boolean()
    .describe("true if the name does not identify a specific dish (e.g. 'Chef's Choice', 'Assorted Desserts', 'Burrito Bar')"),
  likely_ingredients: z.array(z.string()).describe("Typical components of the institutional recipe, most important first (max ~12)"),
  allergens: z.object(Object.fromEntries(ASSESSED_ALLERGENS.map((a) => [a, AssertionSchema])) as Record<
    (typeof ASSESSED_ALLERGENS)[number],
    typeof AssertionSchema
  >),
  tree_nut_types: z.array(z.enum(TREE_NUT_SUBTYPES)).describe("Specific tree nuts if tree_nuts is contains/may_contain and identifiable"),
  vegetarian: z.enum(["yes", "no", "unsure"]),
  vegan: z.enum(["yes", "no", "unsure"]),
  fried: z.boolean().describe("true if typically deep-fried (shared fryer oil risk)"),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function toProfileData(o: ResearchOutput): AllergenProfileData {
  const allergens = Object.fromEntries(
    ASSESSED_ALLERGENS.map((a) => [a, { ...o.allergens[a], confidence: clamp01(o.allergens[a].confidence) }]),
  ) as AllergenProfileData["allergens"];
  return {
    allergens,
    treeNutTypes: o.tree_nut_types,
    diets: { vegetarian: o.vegetarian, vegan: o.vegan },
    likelyIngredients: o.likely_ingredients.slice(0, 15),
    fried: o.fried,
  };
}
