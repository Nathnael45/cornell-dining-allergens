/**
 * Deterministic keyword safety floor (ARCHITECTURE.md §6.4 Step 5).
 *
 * Rules read a dish name (or an ingredients list) and set a MINIMUM status per allergen.
 * The floor can only raise severity — never lower it — so a false positive costs an
 * over-cautious "check at station"; a false negative is impossible to introduce here.
 * Every hit is recorded so the reason is auditable.
 */
import { raise, type AllergenProfileData, type AssessedAllergen, type Status } from "./status";

type Rule = {
  allergen: AssessedAllergen;
  status: Exclude<Status, "free" | "unknown">;
  match: RegExp;
  /** If this matches the same text, the rule doesn't fire (e.g. "vegan cheese"). */
  unless?: RegExp;
};

const VEGAN = /\b(vegan|plant[- ]based|dairy[- ]free|non[- ]?dairy|cheeze|just egg)\b/i;
const GLUTEN_FREE = /\b(gf|gluten[- ]free)\b/i;

export const FLOOR_RULES: Rule[] = [
  // milk
  { allergen: "milk", status: "contains", unless: VEGAN,
    match: /\b(cheese|cheesy|cheddar|mozzarella|parmesan|parmigiano|feta|ricotta|gouda|brie|provolone|queso|cotija|paneer|alfredo|buttermilk|yogurt|yoghurt|ghee|whey|custard|latte|tzatziki|raita|bechamel|mac (and|&) cheese)\b/i },
  { allergen: "milk", status: "contains", unless: /\b(peanut|sun|sunflower|almond|apple|cocoa|cashew|nut|seed) butter\b|\bvegan\b/i, match: /\bbutter(ed|y)?\b/i },
  { allergen: "milk", status: "contains", unless: /\b(coconut|oat|almond|soy|rice|cashew) (milk|cream)\b|\bcream of tartar\b|\bvegan\b|\bnon[- ]?dairy\b/i,
    match: /\b(milk|cream|creamed|ice cream|sour cream|whipped cream)\b/i },
  { allergen: "milk", status: "may_contain", unless: VEGAN, match: /\b(creamy|chowder|bisque|pudding|mashed potato(es)?|scalloped|au gratin|grilled cheese|pizza)\b/i },
  // egg
  { allergen: "egg", status: "contains", unless: /\beggplant\b|\bjust egg\b|\begg[- ]?less\b|\bvegan\b/i,
    match: /\b(eggs?|omelet(te)?|frittata|quiche|mayo|mayonnaise|aioli|meringue|hollandaise|carbonara|french toast|egg drop|egg noodles?|custard|tamago(yaki)?)\b/i },
  { allergen: "egg", status: "may_contain", unless: VEGAN, match: /\b(egg rolls?|fried rice|pancakes?|waffles?|cake|cookies?|brownies?|muffins?|meatballs?|crab cakes?|breaded|battered|tempura|challah|brioche)\b/i },
  // fish
  { allergen: "fish", status: "contains", unless: /\bshellfish\b|\bvegan\b/i,
    match: /\b(fish|salmon|tuna|cod|tilapia|pollock|haddock|halibut|trout|catfish|swordfish|mahi|anchov(y|ies)|sardines?|bonito|fish sauce|branzino|sea bass|snapper|flounder)\b/i },
  { allergen: "fish", status: "may_contain", match: /\b(caesar|worcestershire|pad thai|kimchi|nuoc cham|dashi|puttanesca)\b/i },
  // shellfish (Cornell labels crustaceans and molluscs as shellfish)
  { allergen: "shellfish", status: "contains", unless: /\bvegan\b|\bimitation\b/i,
    match: /\b(shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|craw(fish|dad)|crayfish|calamari|squid|octopus|shellfish|seafood)\b/i },
  { allergen: "shellfish", status: "may_contain", match: /\b(paella|gumbo|jambalaya|oyster sauce|imitation crab|surimi|seafood)\b/i },
  // peanuts
  { allergen: "peanuts", status: "contains", match: /\b(peanuts?|groundnuts?)\b/i },
  { allergen: "peanuts", status: "may_contain", match: /\b(satay|pad thai|kung pao|thai peanut|trail mix|mole)\b/i },
  // tree nuts (coconut is separate at Cornell since 2023)
  { allergen: "tree_nuts", status: "contains", unless: /\bnut[- ]free\b/i,
    match: /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|macadamias?|pine nuts?|brazil nuts?|chestnuts?|praline|marzipan|nutella|frangipane|baklava|amaretti|filberts?)\b/i },
  { allergen: "tree_nuts", status: "may_contain", unless: /\bnut[- ]free\b|\bnutmeg\b|\bbutternut\b|\b(dough|do)nuts?\b|\bcoconut\b/i,
    match: /\b(nuts?|nutty|pesto|granola|romesco|korma|biryani|trail mix|mole|streusel)\b/i },
  // coconut
  { allergen: "coconut", status: "contains", match: /\bcoconut\b/i },
  { allergen: "coconut", status: "may_contain", match: /\b(thai|red|green|yellow|massaman|panang|jamaican|caribbean|keralan?)\b.*\bcurry\b|\b(laksa|tom kha|pina colada)\b/i },
  // soy
  { allergen: "soy", status: "contains",
    match: /\b(soy|soya|tofu|tempeh|edamame|miso|tamari|teriyaki|hoisin|shoyu|natto|bulgogi|yakisoba|lo mein|ramen)\b/i },
  { allergen: "soy", status: "may_contain",
    match: /\b(stir[- ]?fry|fried rice|general tso|orange chicken|sesame chicken|dumplings?|potstickers?|gyoza|wontons?|bao|bun bao|egg rolls?|spring rolls?|asian|kung pao|veggie burger|vegan (meatballs?|tenders?|sausage|chicken)|impossible|beyond|seitan|tamari egg|katsu|mapo)\b/i },
  // sesame
  { allergen: "sesame", status: "contains", match: /\b(sesame|tahini|hummus|halva|za'?atar|furikake|gomae|benne)\b/i },
  { allergen: "sesame", status: "may_contain", match: /\b(bagels?|buns?|falafels?|bibimbap|poke|sushi|baba ganoush|everything)\b/i },
  // wheat (wheat ⇒ gluten via consistency rules)
  { allergen: "wheat", status: "contains", unless: GLUTEN_FREE,
    match: /\b(bread|breads|breadsticks?|bun|buns|rolls?|bagels?|pitas?|naan|flatbread|focaccia|ciabatta|baguette|croissants?|biscuits?|scones?|muffins?|pancakes?|waffles?|crepes?|french toast|sandwich(es)?|subs?|wraps?|burritos?|quesadillas?|pizza|calzones?|strombolis?|pasta|spaghetti|penne|rigatoni|ziti|fettuccine|linguine|macaroni|mac (and|&) cheese|lasagna|ravioli|tortellini|orzo|couscous|bulgur|farro|seitan|noodles?|lo mein|udon|ramen|dumplings?|potstickers?|gyoza|wontons?|egg rolls?|empanadas?|knish(es)?|matzo|matzoh|crackers?|pretzels?|croutons?|stuffing|breaded|battered|tempura|panko|crusted|cookies?|cakes?|cupcakes?|brownies?|pies?|crisp|cobbler|pastry|pastries|danish|donuts?|doughnuts?|churros?|twists?|cream puffs?|bao|banh mi|gravy|roux|teriyaki|hoisin|soy sauce)\b/i },
  { allergen: "wheat", status: "may_contain", unless: GLUTEN_FREE,
    match: /\b(fried chicken|tenders?|nuggets?|fritters?|meatballs?|meatloaf|burgers?|cheeseburgers?|tacos?|nachos?|enchiladas?|chowder|bisque|stew|pot pie|casserole|soup|gnocchi|granola|oats?|oatmeal|tortillas?|spring rolls?|fried|katsu|orange chicken|general tso|sesame chicken)\b/i },
  // gluten-only grains
  { allergen: "gluten", status: "contains", unless: GLUTEN_FREE, match: /\b(barley|rye|malt|malted|pumpernickel|spelt|triticale)\b/i },
  // pork
  { allergen: "pork", status: "contains", unless: /\b(turkey|chicken|beef|vegan|veggie|plant[- ]based) (bacon|ham|sausage|pepperoni|hot dogs?)\b|\bvegan\b|\bhalal\b/i,
    match: /\b(pork|bacon|ham|prosciutto|pancetta|chorizo|pepperoni|salami|soppressata|carnitas|char siu|lard|kielbasa|bratwurst|andouille|guanciale|capicola|mortadella|tonkotsu|lechon|porchetta|cochinita)\b/i },
  { allergen: "pork", status: "may_contain", unless: /\bvegan\b|\bhalal\b|\bkosher\b/i,
    match: /\b(sausages?|hot dogs?|meatballs?|banh mi|dumplings?|potstickers?|gyoza|wontons?|bao|baked beans|collard greens|carbonara|jambalaya|gumbo|cassoulet|pozole|breakfast meat|meat lovers?)\b/i },
  // gelatin (usually pork-derived) in desserts — found via Cornell's "Godiva Chocolate Cheesecake" label
  { allergen: "pork", status: "may_contain", unless: /\bvegan\b|\bkosher\b|\bhalal\b/i,
    match: /\b(gelatin|jell-?o|marshmallows?|gumm(y|ies)|panna cotta|mousse|cheesecakes?|parfaits?|trifle|aspic)\b/i },
  // alcohol
  // Cornell labels alcohol for wine vinegars (incl. balsamic) and vanilla/flavor extracts — 19% of its labels.
  { allergen: "alcohol", status: "contains", unless: /\bnon[- ]?alcoholic\b/i,
    match: /\b(wine|beer|vodka|rum|bourbon|whiske?y|sake|mirin|marsala|sherry|brandy|cognac|tequila|kahlua|amaretto|coq au vin|bourguignon|beer[- ]battered|rum cake|balsamic|vanilla extract)\b/i },
  { allergen: "alcohol", status: "may_contain",
    match: /\b(tiramisu|vodka sauce|scampi|piccata|teriyaki|bulgogi|stroganoff|flambe|fondue|vinaigrette|pickled|vanilla|extract|italian dressing|greek dressing)\b/i },
];

export type FloorHit = { allergen: AssessedAllergen; status: Status; matched: string };

export function floorHits(text: string): FloorHit[] {
  const hits: FloorHit[] = [];
  for (const r of FLOOR_RULES) {
    if (r.unless?.test(text)) continue;
    const m = text.match(r.match);
    if (m) hits.push({ allergen: r.allergen, status: r.status, matched: m[0] });
  }
  return hits;
}

/** Apply the floor to a profile (returns a copy). `source` labels where the text came from. */
export function applyFloor(input: AllergenProfileData, text: string, source = "name"): { profile: AllergenProfileData; hits: FloorHit[] } {
  const profile = structuredClone(input);
  const hits = floorHits(text);
  for (const h of hits) raise(profile, h.allergen, h.status, `keyword floor (${source}): "${h.matched}"`, 0.9);
  return { profile, hits };
}

/** Meat words ⇒ not vegetarian, regardless of what the model said. */
const MEAT = /\b(chicken|beef|pork|turkey|lamb|veal|duck|goat|bacon|ham|sausage|pepperoni|salami|steak|brisket|meatballs?|meatloaf|chorizo|prosciutto|carnitas|pastrami|corned beef|hot dogs?|burgers?|fish|salmon|tuna|shrimp|crab|lobster|clams?|anchov(y|ies))\b/i;
const MEAT_EXCEPTION = /\b(vegan|vegetarian|veggie|plant[- ]based|impossible|beyond|meatless|tofu|seitan|black bean burger|mushroom burger|garden burger)\b/i;

export function applyMeatRule(input: AllergenProfileData, text: string): AllergenProfileData {
  if (!MEAT.test(text) || MEAT_EXCEPTION.test(text)) return input;
  const p = structuredClone(input);
  p.diets.vegetarian = "no";
  p.diets.vegan = "no";
  return p;
}
