import { describe, expect, it } from "vitest";
import { mapCornellAllergens } from "@/lib/allergens/taxonomy";
import { decodeHtml, panelsHtml, parseLabel, parseListing, parseUnits } from "@/lib/cornell/netnutrition";
import { labelHtml } from "./fixtures";

describe("parseLabel (real label fixture)", () => {
  const label = parseLabel(labelHtml());

  it("extracts name, serving, ingredients", () => {
    expect(label.name).toBe("Asian Sesame Chicken Sandwich");
    expect(label.servingSize).toBe("Sandwich (319g)");
    expect(label.ingredients).toMatch(/^Chicken Breast\(Boneless skinless/);
    expect(label.ingredients).toContain("Sesame Oil");
    expect(label.ingredients).not.toContain("&nbsp;");
  });

  it("extracts the official Contains line and maps it", () => {
    expect(label.hasContainsLine).toBe(true);
    expect(label.containsRaw).toEqual(["Egg", "Gluten", "Sesame", "Soy", "Wheat"]);
    expect(label.allergens).toEqual(["egg", "soy", "sesame", "wheat", "gluten"]);
    expect(label.unmappedAllergens).toEqual([]);
  });

  it("distinguishes a missing Contains line from an empty one", () => {
    const noLine = parseLabel(labelHtml().replace(/<span class='cbo_nn_LabelAllergensBold'>[\s\S]*$/, ""));
    expect(noLine.hasContainsLine).toBe(false);
    expect(noLine.allergens).toEqual([]);
  });
});

describe("mapCornellAllergens", () => {
  it("rolls tree-nut subtypes up and wheat into gluten", () => {
    expect(mapCornellAllergens(["Walnuts", "Wheat"]).allergens).toEqual(["tree_nuts", "walnut", "wheat", "gluten"]);
    expect(mapCornellAllergens(["Hazelnut and Hazelnut Products"]).allergens).toEqual(["tree_nuts", "hazelnut"]);
  });
  it("never silently drops unknown names", () => {
    expect(mapCornellAllergens(["Lupin", "Milk"])).toEqual({ allergens: ["milk"], unmapped: ["Lupin"] });
  });
});

describe("listing parsers", () => {
  it("parses units, items, menus, courses", () => {
    expect(parseUnits(`<a onclick="NetNutrition.UI.unitsSelectUnit(7)" href="#">Trillium</a>`)).toEqual([{ oid: 7, name: "Trillium" }]);
    const html = panelsHtml(
      JSON.stringify({
        panels: [
          { id: "itemPanel", html: `<a onclick="NetNutrition.UI.getItemNutritionLabelOnClick(event, 123)">Mac &amp; Cheese</a>` },
          { id: "coursesPanel", html: `<a onclick="NetNutrition.UI.selectCourse(136)">x</a><a onclick="menuListSelectMenu(9)">y</a>` },
        ],
      }),
    );
    const l = parseListing(html);
    expect([...l.items]).toEqual([[123, "Mac & Cheese"]]);
    expect(l.courses).toEqual([136]);
    expect(l.menus).toEqual([9]);
  });
  it("decodes entities", () => expect(decodeHtml("A&nbsp;&amp;&#39;B&#x27;")).toBe("A &'B'"));

  it("drops section headers and cross-references seen in real listings", () => {
    const row = (oid: number, name: string) => `<a onclick="NetNutrition.UI.getItemNutritionLabelOnClick(event, ${oid})">${name}</a>`;
    const l = parseListing(
      row(1, "BURGER TOPPINGS:") + row(2, "See Dining Facility: Baked Goods") + row(3, "Sour Cream") + row(4, "Ratio: 2 Eggs"),
    );
    expect([...l.items.values()]).toEqual(["Sour Cream", "Ratio: 2 Eggs"]);
  });
});
