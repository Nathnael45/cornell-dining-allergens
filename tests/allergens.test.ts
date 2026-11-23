import { describe, expect, it } from "vitest";
import { applyFloor, applyMeatRule, floorHits } from "@/lib/allergens/keyword-floor";
import { applyConsistency, mergeProfiles, SEVERITY, unknownProfile, type AllergenProfileData, type AssessedAllergen, type Status } from "@/lib/allergens/status";
import { officialProfile, officialTruth } from "@/lib/research/official";

/** A profile where everything is `free` except the given overrides. */
function profile(over: Partial<Record<AssessedAllergen, Status>> = {}, extra: Partial<AllergenProfileData> = {}): AllergenProfileData {
  const p = unknownProfile("");
  for (const a of Object.keys(p.allergens) as AssessedAllergen[]) p.allergens[a] = { status: over[a] ?? "free", confidence: 0.9, reason: "" };
  p.diets = { vegetarian: "yes", vegan: "yes" };
  return { ...p, ...extra };
}

/** Strongest floor status per allergen (mirrors how applyFloor raises). */
const floorOf = (name: string) => {
  const out: Partial<Record<AssessedAllergen, Status>> = {};
  for (const h of floorHits(name)) if (!out[h.allergen] || SEVERITY[h.status] > SEVERITY[out[h.allergen]!]) out[h.allergen] = h.status;
  return out;
};

describe("keyword floor", () => {
  it.each<[string, Partial<Record<AssessedAllergen, Status>>]>([
    ["Broccoli Cheddar Soup", { milk: "contains" }],
    ["Kettle Cuisine New England Clam Chowder", { shellfish: "contains", milk: "may_contain" }],
    ["Pork & Vegetable Lo Mein", { pork: "contains", soy: "contains", wheat: "contains" }],
    ["Parmesan & Pine Nut Roasted Green Beans", { milk: "contains", tree_nuts: "contains" }],
    ["Thai Red Curry Tofu & Vegetables", { soy: "contains", coconut: "may_contain" }],
    ["Hoisin Mayo", { soy: "contains", egg: "contains", wheat: "contains" }],
    ["Falafels with Flatbread and Toppings", { wheat: "contains", sesame: "may_contain" }],
    ["Sausage Mushroom Pepper & Onion Pizza", { pork: "may_contain", wheat: "contains", milk: "may_contain" }],
  ])("%s", (name, expected) => {
    expect(floorOf(name)).toMatchObject(expected);
  });

  it("respects vegan / GF / look-alike exceptions", () => {
    expect(floorOf("GF Vegan Grilled Cheeze")).not.toHaveProperty("milk");
    expect(floorOf("GF Vegan Grilled Cheeze")).not.toHaveProperty("wheat");
    expect(floorOf("Vegan Cheese Pizza")).not.toHaveProperty("milk");
    expect(floorOf("Roasted Eggplant")).not.toHaveProperty("egg");
    expect(floorOf("Butternut Squash Soup")).not.toHaveProperty("tree_nuts");
    expect(floorOf("Peanut Butter Cookie")).toMatchObject({ peanuts: "contains" });
    expect(floorOf("Peanut Butter Cookie").milk).toBeUndefined();
    expect(floorOf("Coconut Rice")).toMatchObject({ coconut: "contains" });
    expect(floorOf("Coconut Rice")).not.toHaveProperty("tree_nuts");
    expect(floorOf("Turkey Bacon")).not.toHaveProperty("pork");
    expect(floorOf("Red Wine Vinaigrette")).toMatchObject({ alcohol: "contains" });
    // Cornell labels wine vinegar as alcohol (e.g. its "Pickled Red Onion" label).
    expect(floorOf("Red Wine Vinegar Dressing")).toMatchObject({ alcohol: "contains" });
    expect(floorOf("Pickled Red Onion")).toMatchObject({ alcohol: "may_contain" });
    expect(floorOf("Vanilla Greek Yogurt")).toMatchObject({ alcohol: "may_contain", milk: "contains" });
    expect(floorOf("Graham Crackers").pork).toBeUndefined();
    expect(floorOf("Godiva Chocolate Cheesecake")).toMatchObject({ pork: "may_contain" });
    expect(floorOf("Vegan Chocolate Mousse").pork).toBeUndefined();
  });

  it("only raises, never lowers", () => {
    const p = profile({ milk: "contains", soy: "may_contain" });
    const { profile: out } = applyFloor(p, "Steamed Jasmine Rice");
    expect(out.allergens.milk.status).toBe("contains");
    expect(out.allergens.soy.status).toBe("may_contain");
    const { profile: raised } = applyFloor(profile(), "Shrimp Fried Rice");
    expect(raised.allergens.shellfish.status).toBe("contains");
    expect(raised.allergens.shellfish.reason).toContain("keyword floor");
  });

  it("meat words make an item non-vegetarian, except plant-based versions", () => {
    expect(applyMeatRule(profile(), "BBQ Chicken").diets).toEqual({ vegetarian: "no", vegan: "no" });
    expect(applyMeatRule(profile(), "Vegan Meatballs with Pasta & Sauce").diets.vegetarian).toBe("yes");
    expect(applyMeatRule(profile(), "Black Bean Burger").diets.vegetarian).toBe("yes");
  });
});

describe("conservative merge", () => {
  it("keeps the more cautious status per allergen and flags free-vs-contains", () => {
    const a = profile({ milk: "contains", soy: "free" });
    const b = profile({ milk: "free", soy: "may_contain" }, { treeNutTypes: ["almond"], fried: true });
    const m = mergeProfiles([a, b]);
    expect(m.profile.allergens.milk.status).toBe("contains");
    expect(m.profile.allergens.soy.status).toBe("may_contain");
    expect(m.profile.treeNutTypes).toEqual(["almond"]);
    expect(m.profile.fried).toBe(true);
    expect(m.hardDisagreements).toEqual(["milk"]);
  });

  it("takes the least confident of equal statuses and the most cautious diet answer", () => {
    const a = profile({}, { diets: { vegetarian: "yes", vegan: "yes" } });
    const b = profile({}, { diets: { vegetarian: "yes", vegan: "unsure" } });
    b.allergens.egg.confidence = 0.4;
    const m = mergeProfiles([a, b]);
    expect(m.profile.allergens.egg.confidence).toBe(0.4);
    expect(m.profile.diets.vegan).toBe("unsure");
  });
});

describe("consistency", () => {
  it("wheat implies gluten; tree-nut subtypes imply tree_nuts; animal products break vegan", () => {
    const p = applyConsistency(profile({ wheat: "may_contain", milk: "contains" }, { treeNutTypes: ["walnut"] }));
    expect(p.allergens.gluten.status).toBe("may_contain");
    expect(p.allergens.tree_nuts.status).toBe("contains");
    expect(p.diets.vegan).toBe("no");
    expect(p.diets.vegetarian).toBe("yes");
    expect(applyConsistency(profile({ fish: "contains" })).diets).toEqual({ vegetarian: "no", vegan: "no" });
  });
});

describe("official profiles", () => {
  const label = (allergens: string[], has = true, ingredients: string | null = null, unitName = "Trillium") => ({
    hasContainsLine: has,
    allergens,
    ingredients,
    unitName,
  });

  it("unions labels across cafés", () => {
    const p = officialProfile([label(["soy", "wheat", "gluten"]), label(["soy", "wheat", "gluten", "coconut"], true, null, "Mattin's")])!;
    expect(p.allergens.coconut).toMatchObject({ status: "contains" });
    expect(p.allergens.coconut.reason).toContain("Mattin's");
    expect(p.allergens.milk.status).toBe("free");
  });

  it("never treats a label without a Contains line as allergen-free (Sour Cream case)", () => {
    expect(officialProfile([label([], false, "Cultured cream, milk")])).toBeNull();
    const p = officialProfile([label(["egg"]), label([], false, "Cultured cream, milk")])!;
    expect(p.allergens.milk.status).toBe("contains");
  });

  it("trusts Cornell's explicit statement over keyword matches in the same label", () => {
    const p = officialProfile([label([], true, "Chocolate, sugar, soy lecithin")])!;
    expect(p.allergens.soy.status).toBe("free");
  });

  it("builds eval truth from authoritative labels only", () => {
    expect([...officialTruth([label(["walnut", "milk"]), label(["sesame"], false)])!].sort()).toEqual(["milk", "tree_nuts"]);
    expect(officialTruth([label(["milk"], false)])).toBeNull();
  });
});
