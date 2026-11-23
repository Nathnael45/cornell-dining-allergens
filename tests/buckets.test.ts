import { describe, expect, it } from "vitest";
import { encode, verdict, type CompactItem, type Prefs } from "@/lib/allergens/buckets";
import { resolve, type StoredProfile } from "@/lib/allergens/resolve";
import { ASSESSED_ALLERGENS, type Assertion, type Status } from "@/lib/allergens/status";

const stored = (over: Partial<Record<string, Status>> = {}, conf = 0.95): StoredProfile => ({
  allergens: Object.fromEntries(ASSESSED_ALLERGENS.map((a) => [a, { status: over[a] ?? "free", confidence: conf, reason: "" } satisfies Assertion])),
  diets: { vegetarian: "yes", vegan: "no" },
  flags: { kind: "researched", fried: false },
  likelyIngredients: [],
});
const ctx = { eateryId: 43, station: "Chef's Table" };
const item = (ai: StoredProfile | null, official: StoredProfile | null = null, c = ctx): CompactItem => ({ id: 1, name: "x", ...encode(resolve(ai, official, c)) });
const prefs = (p: Partial<Prefs>): Prefs => ({ avoid: [], diets: [], strict: false, ...p });

describe("resolve", () => {
  it("official labels add caution but never remove it", () => {
    const r = resolve(stored({ milk: "contains" }), stored({ soy: "contains" }), ctx);
    expect(r.allergens.milk).toMatchObject({ status: "contains", source: "ai" });
    expect(r.allergens.soy).toMatchObject({ status: "contains", source: "official" });
    expect(r.allergens.egg).toMatchObject({ status: "free", source: "official" });
  });

  it("applies Cornell certifications by hall and station", () => {
    const risley = resolve(stored({ wheat: "contains", gluten: "contains", milk: "contains" }), null, { eateryId: 4, station: "Pizza" });
    expect(risley.allergens.gluten).toMatchObject({ status: "free", source: "policy" });
    expect(risley.allergens.milk.status).toBe("contains");
    const halal = resolve(stored({ pork: "may_contain" }), null, { eateryId: 43, station: "Halal" });
    expect(halal.allergens.pork).toMatchObject({ status: "free", source: "policy" });
  });

  it("unresearched items are unknown, never free", () => {
    expect(encode(resolve(null, null, ctx)).code).toBe("U".repeat(ASSESSED_ALLERGENS.length));
  });
});

describe("verdict", () => {
  it("sorts into fits / check / avoid for the user's restrictions", () => {
    expect(verdict(item(stored({ milk: "contains" })), prefs({ avoid: ["milk"] }))).toEqual({ bucket: "avoid", notes: ["Contains milk"] });
    expect(verdict(item(stored({ soy: "may_contain" })), prefs({ avoid: ["soy"] })).bucket).toBe("check");
    expect(verdict(item(stored()), prefs({ avoid: ["milk", "soy"] })).bucket).toBe("fits");
    expect(verdict(item(stored({}, 0.6)), prefs({ avoid: ["milk"] }))).toEqual({ bucket: "check", notes: ["Milk not confirmed"] });
  });

  it("strict mode only lets Cornell-verified absence count as fits", () => {
    expect(verdict(item(stored()), prefs({ avoid: ["milk"], strict: true })).bucket).toBe("check");
    expect(verdict(item(stored(), stored()), prefs({ avoid: ["milk"], strict: true })).bucket).toBe("fits");
  });

  it("handles diets and placeholders", () => {
    expect(verdict(item(stored()), prefs({ diets: ["vegan"] }))).toEqual({ bucket: "avoid", notes: ["Not vegan"] });
    expect(verdict(item(stored()), prefs({ diets: ["vegetarian"] })).bucket).toBe("fits");
    const ph = { ...item(stored()), placeholder: true };
    expect(verdict(ph, prefs({ avoid: ["milk"] }))).toEqual({ bucket: "check", notes: ["Varies day to day"] });
    expect(verdict(item(null), prefs({ avoid: ["egg"] })).bucket).toBe("check");
  });
});

describe("gluten-free likelihood", () => {
  const withGf = (rating: "definitely" | "likely" | "less_likely" | "unlikely", gluten: Status = "may_contain") => {
    const p = stored({ gluten, wheat: gluten });
    p.flags = { kind: "researched", gf: { rating, reason: "" } };
    return p;
  };

  it("replaces the cautious gluten status when the user avoids gluten", () => {
    expect(verdict(item(withGf("likely")), prefs({ avoid: ["gluten"] })).bucket).toBe("fits");
    expect(verdict(item(withGf("definitely")), prefs({ avoid: ["gluten"] })).bucket).toBe("fits");
    expect(verdict(item(withGf("less_likely")), prefs({ avoid: ["gluten"] }))).toEqual({ bucket: "check", notes: ["Gluten-free less likely"] });
    expect(verdict(item(withGf("unlikely", "contains")), prefs({ avoid: ["gluten"] }))).toEqual({ bucket: "avoid", notes: ["Usually contains gluten"] });
    // Wheat is still judged by its own status.
    expect(verdict(item(withGf("likely")), prefs({ avoid: ["wheat"] })).bucket).toBe("check");
  });

  it("Cornell labels and certifications override the estimate", () => {
    expect(resolve(withGf("likely"), stored({ gluten: "contains" }), ctx).gf).toMatchObject({ rating: "unlikely", source: "official" });
    expect(resolve(withGf("unlikely", "contains"), null, { eateryId: 4, station: "Pizza" }).gf).toMatchObject({ rating: "definitely", source: "policy" });
    expect(item(withGf("likely"), stored()).gf).toBe("D");
  });

  it("strict mode needs Cornell verification for gluten too", () => {
    expect(verdict(item(withGf("definitely")), prefs({ avoid: ["gluten"], strict: true })).bucket).toBe("check");
    expect(verdict(item(withGf("definitely"), stored()), prefs({ avoid: ["gluten"], strict: true })).bucket).toBe("fits");
  });

  it("falls back to the gluten status for foods without a rating, and says nothing for placeholders", () => {
    expect(resolve(stored({ gluten: "contains" }), null, ctx).gf?.rating).toBe("unlikely");
    const ph = stored();
    ph.flags = { kind: "placeholder" };
    expect(resolve(ph, null, ctx).gf).toBeNull();
  });
});
