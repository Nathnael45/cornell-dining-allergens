/**
 * Food identity. The API gives us only a name, so identity = a normalized name key.
 *
 * Deliberately conservative: we normalize formatting only (case, spacing, punctuation, "&"),
 * never meaning. "Vegan Chili" and "Chili", or "Char-Grilled Chicken" and "Grilled Chicken",
 * stay distinct because their allergens can differ. Plurals are NOT collapsed for the same
 * reason; merges happen only through manual `food_aliases`.
 */

export function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'") // curly apostrophes
    .replace(/[“”]/g, '"')
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/'/g, "") // chef's -> chefs
    .replace(/[^a-z0-9"% ]+/g, " ") // other punctuation -> space ("Char-Grilled" -> "char grilled")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean up the display name without changing its meaning. */
export function displayName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Names that describe a rotating/build-your-own offering rather than a specific dish.
 * They cannot be researched meaningfully, so they will always show "Check at station".
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bchef'?s choice\b/i,
  /^assorted\b/i,
  /\bassorted\b.*\b(toppings|desserts|breads?|rolls|beverages|cookies|danish|muffins|pastries)\b/i,
  /^create your own\b/i,
  /^build your own\b/i,
  /^customizable\b/i,
  /\bbar$/i, // "Burrito Bar", "Waffle Bar", "Congee Bar"
  /\bbuffet$/i,
  /\b(beverage|drink) service\b/i,
  /\bsweets (and|&) treats\b/i,
  /^(hot (and|&) cold )?beverages?$/i,
];

/**
 * Items that are status notices, not food. Seen in real data: "Closed" listed as the only item
 * under a normal station (North Star "Create", 2026-11-23) and under "* Announcements *".
 */
const NOTICE_ITEM = /^(station |temporarily |currently )?closed( today| for (the )?(holiday|break|today))?[.!]?$/i;

export function isNoticeItem(name: string): boolean {
  return NOTICE_ITEM.test(name.trim());
}

export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(name.trim()));
}
