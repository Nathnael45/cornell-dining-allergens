import { describe, expect, it } from "vitest";
import { isNoticeItem, isPlaceholderName, nameKey } from "@/lib/ingest/normalize";

describe("nameKey", () => {
  it("normalizes formatting only", () => {
    expect(nameKey("  Chicken & Broccoli ")).toBe("chicken and broccoli");
    expect(nameKey("Chicken and Broccoli")).toBe("chicken and broccoli");
    expect(nameKey("Chef’s Table")).toBe(nameKey("Chef's Table"));
    expect(nameKey("Char-Grilled Chicken")).toBe("char grilled chicken");
  });

  it("keeps meaningfully different names distinct (allergen safety)", () => {
    expect(nameKey("Vegan Chili")).not.toBe(nameKey("Chili"));
    expect(nameKey("Char-Grilled Chicken")).not.toBe(nameKey("Grilled Chicken"));
    expect(nameKey("GF Vegan Grilled Cheeze")).not.toBe(nameKey("Grilled Cheese"));
    expect(nameKey("Pickled Red Onions")).not.toBe(nameKey("Pickled Red Onion")); // no auto-plural merge
  });
});

describe("isPlaceholderName", () => {
  it.each(["Chef's Choice", "Chef's Choice Vegan Entree", "Assorted Rolls", "Burrito Bar", "Create Your Own Waffle",
    "Dim Sum Buffet", "Hot & Cold Beverage Service", "Customizable Iron Grill Stir-Fry", "Lunch Sweets & Treats"])(
    "flags %s",
    (n) => expect(isPlaceholderName(n)).toBe(true),
  );
  it.each(["Thai Red Curry Tofu & Vegetables", "Cheese Pizza", "Steamed Jasmine Rice", "Granola Bar Cookies Crumble Topping"])(
    "does not flag %s",
    (n) => expect(isPlaceholderName(n)).toBe(false),
  );
});

describe("isNoticeItem", () => {
  it.each(["Closed", "closed", "Station Closed", "Closed Today", "Closed for the holiday."])("treats %s as a notice", (n) =>
    expect(isNoticeItem(n)).toBe(true),
  );
  it.each(["Closed Face Sandwich", "Cheese Pizza", "Enclosed Burrito"])("treats %s as food", (n) => expect(isNoticeItem(n)).toBe(false));
});
