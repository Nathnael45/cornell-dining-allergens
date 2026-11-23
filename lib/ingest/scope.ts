/**
 * v1 scope: "main meal parts" of the residential dining rooms (ARCHITECTURE.md §2).
 * Expanding scope later is an edit to this file only.
 */
import type { StationKind } from "@/lib/db/schema";
import type { Eatery } from "@/lib/cornell/dining-api";

export const MEALS_IN_SCOPE = new Set(["Breakfast", "Brunch", "Lunch", "Dinner"]);

/** Station names exactly as returned by the API (37 seen on 2026-11-20). */
const STATION_KINDS: Record<string, StationKind> = {
  // main entrée stations
  "Chef's Table": "main",
  Global: "main",
  Grill: "main",
  "Iron Grill": "main",
  "Flat Top Grill": "main",
  Wok: "main",
  "Wok/Asian Station": "main",
  Pizza: "main",
  "Pizza Station": "main",
  "House Made Pasta": "main",
  "Al Forno": "main",
  "Mexican Station": "main",
  Halal: "main",
  "Kosher Station": "main",
  "Specialty Station": "main",
  Special: "main",
  "Special Menu Event": "main",
  Bowl: "main",
  "Build Your Own Bowl Choices": "main",
  Create: "main",
  Green: "main",
  "Vegan/Vegetarian Offerings": "main",
  "Breakfast Menu Options": "main",
  // sides & soup
  "Chef's Table - Sides": "side",
  Soup: "soup",
  // out of scope for v1
  Salad: "salad",
  "Fruit & Yogurt Bar": "salad",
  "Bagel Bar/Cereal": "breakfast_cold",
  "Breakfast Station - Cold": "breakfast_cold",
  Dessert: "dessert",
  Desserts: "dessert",
  "Baked Goods": "dessert",
  Beverage: "beverage",
  Beverages: "beverage",
  "Beverage Bar": "beverage",
  "Condiments/Toppings": "condiment",
  "Specialty Bar": "condiment",
};

const IN_SCOPE_KINDS = new Set<StationKind>(["main", "side", "soup"]);

/** "* Announcements *" (seen 2026-11-23 carrying "Closed" for holiday meals) and variants. */
export const isAnnouncementCategory = (name: string) => /announcement/i.test(name);

export function classifyStation(name: string): { kind: StationKind; inScope: boolean } {
  if (isAnnouncementCategory(name)) return { kind: "announcement", inScope: false };
  const kind = STATION_KINDS[name.trim()] ?? "unclassified";
  return { kind, inScope: IN_SCOPE_KINDS.has(kind) };
}

export function isDiningRoom(e: Pick<Eatery, "eateryTypes">): boolean {
  return e.eateryTypes.some((t) => t.descr === "Dining Room");
}

export function normalizeMealName(descr: string): string {
  const d = descr.trim();
  return d === "" ? "Other" : d;
}

export function isMealInScope(descr: string): boolean {
  return MEALS_IN_SCOPE.has(normalizeMealName(descr));
}
