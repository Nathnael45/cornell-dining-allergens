# Cornell Dining Allergen Finder — Architecture & Plan

> **Goal:** A website where someone with a dietary restriction picks their restrictions once and
> immediately sees, per dining hall and meal, what they can eat — with honest signals about how
> sure we are.
>
> Research for this plan was done on 2026‑11‑20 against the live Cornell systems. Raw snapshots
> are in `fixtures/` and the NetNutrition probe is in `scripts/probe_netnutrition.py`.

---

## 1. What the research found

### 1.1 Cornell Dining menu API (source of *what is served*)

| | |
|---|---|
| Endpoint | `GET https://admin-now.dining.cornell.edu/api/1.0/dining/eateries.json` |
| Auth | None (public, **undocumented**) |
| ⚠️ Moved | The old, widely cited `now.dining.cornell.edu/api/1.0/...` now returns the Angular SPA HTML (HTTP 200!). The real host was found in the SPA bundle config. **Expect it to move again.** |
| CORS | No `Access-Control-Allow-Origin`, plus `cross-origin-resource-policy: same-origin` → **browsers cannot call it; we must fetch server-side.** |
| Caching | `cache-control: no-store` → we cache it ourselves. |
| Size | ~420 KB, 32 eateries, 8 days of data (yesterday + next 7). |

Shape (only the fields that matter):

```
data.eateries[]                       32 eateries
  id, slug, name, campusArea.descrshort, eateryTypes[].descr ("Dining Room" | "Cafe" | ...)
  nutrition                           free-text HTML (Risley's certification note lives here)
  operatingHours[]                    one per date
    date: "2026-11-20", status: "EVENTS"
    events[]                          one per meal period
      descr: "Breakfast" | "Brunch" | "Lunch" | "Late Lunch" | "Dinner" | "Late Night" | ""
      start/end ("7:00am"), startTimestamp/endTimestamp (epoch seconds)
      menu[]                          one per STATION
        category: "Chef's Table" | "Grill" | "Halal" | ...,  sortIdx
        items[]: { item: "Thai Red Curry Tofu & Vegetables", healthy: false, sortIdx }
  diningItems[]                       static item list used by cafés (not meal-specific)
```

Key facts that drive the design:

- **Items have only a name.** No item ID, no ingredients, no allergens. `healthy` is `false` for all
  3,733 rows → useless. **Food identity must be derived from the normalized name.**
- Only the **10 "Dining Room" eateries** have per-meal menus: 104West!, Becker, Cook, Jansen's
  (Bethe), Keeton, Morrison, North Star, Okenshields, Risley, Rose. Cafés only have static `diningItems`.
- Across one week: **3,733 menu rows → only 1,039 unique food names** (926 in main-meal scope, §2).
  Heavy repetition ("Steamed Jasmine Rice" appears 59×) → **research-once-and-cache is very
  efficient.**
- 37 station categories. Some are semantically useful: `Halal`, `Kosher Station`,
  `Vegan/Vegetarian Offerings`.
- ~33 main-scope names are placeholders: "Chef's Choice", "Assorted Rolls", "Burrito Bar",
  "Create Your Own Waffle". These cannot be researched meaningfully.
- Some names carry hints: "Vegan …", "GF …", "Halal …", "Kosher …", "Non Dairy …".

### 1.2 Cornell NetNutrition (CBORD) — official labels, but mostly retail

`https://netnutrition.dining.cornell.edu/NetNutrition/1` — the Dining Now SPA links here for nutrition.

- It is an ASP.NET app with **session-cookie-driven AJAX endpoints** (no public API):
  `POST Unit/SelectUnitFromUnitsList {unitOid}` → `POST Menu/SelectCourse {oid}` →
  `POST NutritionDetail/ShowItemNutritionLabel {detailOid}` (returns an HTML label).
- **Each label has full ingredients and an official "Contains:" line**, e.g. for *Asian Sesame
  Chicken Sandwich*: `Contains: Egg, Gluten, Sesame, Soy, Wheat`.
- **Cornell's official allergen taxonomy** (from its filter panel):
  Alcohol, Almonds, Coconut, Egg, Fish, Gluten, Hazelnut, Macadamia, Milk, Peanuts, Pecan,
  Pistachio, Pork, Sesame, Shellfish, Soy, Tree Nuts, Walnuts, Wheat · Preferences: Halal,
  Kosher, Vegan, Vegetarian.
- **Coverage problem:** its 19 units are retail cafés + Risley FreshTake, INDIGO Kitchen,
  Grab & Go, etc. **No residential dining room menus.** 521 unique items in total.
- Name overlap with dining-hall menus: **65 / 1,039 exact (~6%)**, plus ~9 fuzzy matches. Some
  fuzzy matches are dangerous to merge ("Char-Grilled Chicken" ≠ "Grilled Chicken").

**Conclusion:** NetNutrition is our *gold-standard reference corpus* and the source for that
~6% of exact matches, not a complete solution. It is also our **evaluation set** (§9).

### 1.3 Cornell's allergen policy (scl.cornell.edu)

- All residential dining-room items **are labeled** for milk, egg, fish, shellfish, tree nuts, peanuts,
  soy, sesame, gluten, coconut (separate from tree nuts since Jan 2023), alcohol, pork, and
  vegetarian/vegan. **But the labels are printed "menu identifier cards" at the station. They are not
  published online.** That gap is exactly what this app fills.
- Fried foods that share oil get a "shared oil" sign → cross-contact matters.
- Hall-level guarantees:
  - **Risley**: sources ingredients and menus *without gluten, peanuts, or tree nuts* (coconut allowed);
    AllerCheck™/MenuTrinfo® certified (current page).
  - **North Star & Jansen's**: menus "don't use tree nuts, but may use coconut" (**2023 news item;
    needs re-verification**).
  - **104West!**: Star‑K certified kosher. **Morrison** has dedicated Halal and Kosher stations.
- Official disclaimer: risk of cross-contact; manufacturers may change formulations without notice.
- Human contact for serious allergies: Dining Nutrition Office (diningnutrition@cornell.edu) and the
  INDIGO accommodation kitchen via Student Disability Services.

> 🔑 **Highest-leverage action, in parallel with building:** email the Dining Nutrition Office. The
> residential allergen data clearly exists in their CBORD system (they print cards from it). An
> official feed would make most of the AI pipeline a fallback rather than the primary source.

---

## 2. v1 scope ("main meal parts")

Configured in one place (`lib/ingest/scope.ts`), so expanding later is a config change.

- **Eateries:** `eateryTypes` contains `"Dining Room"` (the 10 halls).
- **Meals:** `Breakfast`, `Brunch`, `Lunch`, `Dinner`. (`Late Lunch` / `Late Night` are a flag away.)
- **Stations included:** Chef's Table, Chef's Table - Sides, Global, Grill, Iron Grill, Flat Top
  Grill, Wok, Wok/Asian Station, Pizza, Pizza Station, House Made Pasta, Al Forno, Mexican Station,
  Halal, Kosher Station, Specialty Station, Special, Special Menu Event, Bowl, Build Your Own Bowl
  Choices, Create, Green, Soup, Vegan/Vegetarian Offerings, Breakfast Menu Options.
- **Excluded for v1:** Salad, Fruit & Yogurt Bar, Bagel Bar/Cereal, Breakfast Station - Cold,
  Dessert(s), Baked Goods, Beverage(s), Beverage Bar, Condiments/Toppings, Specialty Bar.
- **Unknown new station names** → stored as `unclassified`, hidden, and surfaced in the admin page
  so a person can classify them. The ingest never silently drops data.

v1 workload: **~926 unique foods** to research once, then only newly seen names each week.

---

## 3. System overview

```
                 ┌──────────────────────────── Vercel ────────────────────────────┐
 Cornell         │                                                                │
 Dining API ─────┼─▶ [Cron: ingest, hourly] ──▶ validate (zod) ──▶ upsert menus ──┐ │
 (admin-now)     │        │ raw snapshot ──▶ Blob/DB (debug + history)            │ │
                 │        └──▶ new food names ──▶ research_jobs (pending)         │ │
                 │                                                               ▼ │
 NetNutrition ───┼─▶ [Cron: weekly] ──▶ netnutrition_items (official labels) ─▶ Postgres
 (CBORD)         │                                                               ▲ │
                 │   [Cron: research worker, every few min] ─────────────────────┤ │
 Claude API ◀─────┼──   1. NetNutrition exact match? → official profile          │ │
 (Sonnet 5.5)   │     2. else: retrieve similar official labels (few-shot)      │ │
 (+ web search   │        + context (station, hall, siblings) → LLM ×2          │ │
  for brands)    │     3. keyword safety floor + consistency checks             │ │
                 │     4. conservative merge → allergen_profiles               │ │
                 │                                                               │ │
                 │   Next.js App Router (RSC, cached, revalidated on ingest) ◀───┘ │
                 │     /            today: halls × meals, "N items fit you"       │
                 │     /halls/[slug]?date&meal   stations → items + badges        │
                 │     /foods/[id]  allergen grid, source, confidence, report     │
                 │     /admin       review queue, unclassified stations           │
                 └────────────────────────────────────────────────────────────────┘
 Browser: restrictions live in localStorage; filtering runs client-side (diet data never leaves the device).
```

---

## 4. Allergen model (the core of the app)

### 4.1 Taxonomy (mirrors Cornell's labels exactly)

```ts
// lib/allergens/taxonomy.ts
ALLERGENS = [
  "milk", "egg", "fish", "shellfish", "peanuts",
  "tree_nuts",            // umbrella; sub-tags below roll up into it
  "almond", "hazelnut", "macadamia", "pecan", "pistachio", "walnut",
  "soy", "sesame", "wheat", "gluten", "coconut",
  "pork", "alcohol",
]
DIETS = ["vegetarian", "vegan", "halal", "kosher"]
EXTRA_FLAGS = ["shared_fryer", "contains_meat", "contains_poultry", "contains_beef"]
```

### 4.2 Each assertion is tri-state plus unknown, with provenance

```ts
type Status = "contains" | "may_contain" | "free" | "unknown";
type Assertion = { status: Status; confidence: number /*0–1*/; reason?: string };

type AllergenProfile = {
  foodId: string;
  eateryId: number | null;        // null = applies everywhere; set = hall-specific (e.g. Risley)
  source: "station_card" | "cornell_official" | "human_review" | "hall_policy" | "ai";
  sourceRef?: string;             // NetNutrition detailOid, photo id, reviewer id, model+prompt version
  allergens: Record<Allergen, Assertion>;
  diets: Record<Diet, Assertion>;
  likelyIngredients: string[];    // shown to users as "typically made with…"
  isPlaceholder: boolean;         // "Chef's Choice", "Assorted Desserts"
  createdAt: Date;
};
```

### 4.3 Resolution: which profile wins (per item, per hall)

Evaluated in order. A higher tier replaces lower tiers per allergen:

1. **Station card** for *this* hall (photo-extracted + human-reviewed)  — *Verified*
2. **Human review** (admin edit)                                       — *Verified*
3. **Hall/station policy** (e.g. Risley → gluten/peanut/tree-nut `free`; Halal station → pork/alcohol `free`)
4. **Cornell official** (NetNutrition exact-name match)                — *Cornell label*
5. **AI research**, merged with the **keyword safety floor**           — *Estimated*

Important properties:

- The **keyword floor can only add** allergens, never remove them (§6.4).
- Hall policies that *remove* allergens are high-impact. Each one carries a citation and
  `verifiedAt`, and only policies confirmed on a current Cornell page are enabled (Risley yes;
  North Star/Jansen's tree-nut rule off until re-verified).
- The same name can have different recipes per hall (Risley's "Cheese Pizza" is gluten-free).
  That's why profiles carry an optional `eateryId`.

### 4.4 What the user sees: three buckets, never "safe"

For a user with restrictions R, each item gets:

| Bucket | Rule | UI |
|---|---|---|
| **Avoid** | any r ∈ R is `contains` | hidden by default ("12 hidden"), expandable, red tag "Contains milk" |
| **Check at station** | any r is `may_contain` / `unknown`, **or** item is a placeholder, **or** r is only AI-`free` with confidence < threshold, **or** the two AI runs disagreed | amber "Check card: soy?" |
| **Fits your filters** | every r is `free` and passes the evidence threshold | green, with a source chip: *Verified* · *Cornell label* · *Estimated* |

- **Strict mode** (toggle, recommended default for severe allergies): only *Verified* / *Cornell
  label* evidence can produce "Fits"; all *Estimated* items drop to "Check".
- Wording is always "No milk listed", never "milk-free" or "safe".
- Persistent footer plus the item drawer: *"Estimates can be wrong and recipes change. Always confirm
  with the station card or ask staff. Severe allergies: contact Dining Nutrition / INDIGO."*
- Fried items show "may share fryer oil" (`shared_fryer`).

---

## 5. Data model (Postgres, via Drizzle ORM)

```sql
eateries (
  id int PRIMARY KEY,            -- Cornell's id (stable: 43 = Morrison)
  slug text UNIQUE, name text, campus_area text,
  is_dining_room bool, lat float, lng float,
  raw_nutrition_note text, updated_at timestamptz
)

stations (
  id serial PRIMARY KEY,
  name text UNIQUE,              -- "Chef's Table - Sides"
  kind text,                     -- main | side | soup | dessert | beverage | salad | condiment | unclassified
  in_scope bool
)

meal_events (
  id serial PRIMARY KEY,
  eatery_id int REFERENCES eateries,
  service_date date, meal text,  -- "Dinner" ('' normalized to 'Other')
  starts_at timestamptz, ends_at timestamptz,
  content_hash text,             -- detect menu changes cheaply
  last_seen_at timestamptz,
  UNIQUE (eatery_id, service_date, meal, starts_at)
)

foods (
  id serial PRIMARY KEY,
  name_key text UNIQUE,          -- normalized identity key (§6.2)
  display_name text,
  is_placeholder bool DEFAULT false,
  research_status text,          -- pending | researching | done | needs_review | failed
  first_seen_at timestamptz, last_seen_at timestamptz, times_seen int
)
food_aliases (alias_key text PRIMARY KEY, food_id int REFERENCES foods)  -- manual merges only

menu_items (
  meal_event_id int REFERENCES meal_events ON DELETE CASCADE,
  station_id int REFERENCES stations,
  food_id int REFERENCES foods,
  sort_idx int,
  PRIMARY KEY (meal_event_id, station_id, food_id)
)

allergen_profiles (
  id serial PRIMARY KEY,
  food_id int REFERENCES foods, eatery_id int NULL REFERENCES eateries,
  source text, source_ref text,
  allergens jsonb, diets jsonb, flags jsonb,
  likely_ingredients text[], reasoning text,
  model text, prompt_version text,
  is_current bool, created_at timestamptz
)  -- append-only history; never overwrite, flip is_current

netnutrition_items (
  detail_oid int PRIMARY KEY, unit_name text,
  name text, name_key text, ingredients text, contains text[], traits text[],
  fetched_at timestamptz
)

hall_policies (
  id serial PRIMARY KEY, eatery_id int, station_pattern text NULL,
  allergen text, effect text,    -- 'free'
  citation_url text, verified_at date, enabled bool
)

reports (
  id serial PRIMARY KEY, food_id int, eatery_id int,
  kind text,                     -- wrong_allergen | station_card_photo | other
  claimed jsonb, note text, photo_url text,
  status text,                   -- open | accepted | rejected
  created_at timestamptz
)

ingest_runs (id serial, started_at, finished_at, status, snapshot_url, stats jsonb, error text)
research_jobs (food_id PRIMARY KEY, attempts int, locked_at timestamptz, last_error text)
```

The read path is one query per hall/day: `menu_items ⨝ foods ⨝ current profiles`. That's ~300
rows, small enough to ship to the client and filter there.

---

## 6. Pipelines

### 6.1 Menu ingest (`/api/cron/ingest`, hourly)

1. `fetch` with timeout + retry. **Reject if `content-type` isn't JSON** (the old URL fails exactly
   this way, returning HTML with a 200), then validate with a zod schema.
2. Store the raw snapshot (Vercel Blob or a `jsonb` column) for debugging and history.
3. Upsert eateries → for each in-scope `Dining Room` × date × event: upsert `meal_events`, skip if
   `content_hash` is unchanged, else replace that event's `menu_items`.
4. Normalize each item name → find or create `foods` (+ alias lookup). New food → `research_jobs`.
5. New station names → `stations(kind='unclassified', in_scope=false)` + admin notice.
6. `revalidateTag('menus')` so cached pages refresh.
7. On failure: keep serving the last good data, show "Menus last updated 3h ago", alert
   (email/Slack webhook), and record the error in `ingest_runs`.

Politeness: 1 request/hour (~24/day) to an undocumented endpoint, cached on our side.

### 6.2 Name normalization (identity key)

`NFKC → lowercase → trim → collapse whitespace → "&"→"and" → strip punctuation except
meaningful tokens → singularize trailing plural`.

**No automatic fuzzy merging.** "Vegan Chili" vs "Chili" or "Char-Grilled" vs "Grilled" can differ
in exactly the way that matters. Fuzzy candidates are only *suggested* to admins (→ `food_aliases`).

### 6.3 NetNutrition sync (`/api/cron/netnutrition`, weekly)

Port `scripts/probe_netnutrition.py` to TS: one cookie session, walk units → menus/courses →
items, fetch each label (~550 requests, 300 ms apart, a few minutes total). Parse `Ingredients:`
and `Contains:` into `netnutrition_items`. Uses: (a) exact-name official profiles, (b) few-shot
grounding for the LLM, (c) the evaluation gold set. HTML scraping is brittle, so it gets parser
tests on the saved `fixtures/netnutrition-label-sample.html`.

### 6.4 Allergen research worker (`/api/cron/research`, every ~5 min, N jobs per run)

Claims jobs with `SELECT … FOR UPDATE SKIP LOCKED`. For each food:

**Step 0. Placeholder detection.** Regex + LLM: "Chef's Choice", "Assorted …", "… Bar",
"Create Your Own …", "… Buffet". Placeholders get all `unknown` → always "Check at station".

**Step 1. Official match.** If `name_key` exactly matches one or more `netnutrition_items.name_key`,
write a `cornell_official` profile from **the union of all matching labels' `Contains:` lines**. The same
name has different official allergens at different cafés (5 such names on 2026‑11‑23, e.g. "Tofu Breakfast
Burrito" ± coconut), so never pick just one. Labels **without** a `Contains:` line are not evidence of
"free": Cornell's own "Sour Cream" label has none while listing cream and milk. Their ingredients go
through the keyword floor + LLM like any other evidence. Still run Step 2 for the diet and extra flags
NetNutrition doesn't express.

**Step 2. Build the context bundle.**
- display name; every station + hall + meal it has appeared in (e.g. Halal, Kosher Station)
- **sibling items** in the same station/event (a "Pork Banh Mi Sandwich Bar" next to "Hoisin Mayo" and
  "Pickled Carrot & Daikon" tells you a lot)
- **top‑5 most similar official Cornell labels** (token overlap or pgvector embeddings over
  `netnutrition_items`), with their ingredients and Contains lines. This grounds the model in *Cornell's*
  suppliers (e.g. their mayo contains egg, and they stock "Gluten Free Tamari")
- Cornell's taxonomy + definitions (coconut ≠ tree nut, vegan/vegetarian definitions)

**Step 3. LLM research** (Anthropic SDK with structured output validated by a zod schema; default model
**Claude Sonnet 5.5**, set in `lib/research/config.ts` and overridable per run, with the §9 eval deciding
whether it meets the safety bar vs Opus 5.5. Caching means only ~50–150 new names per week, and the
backfill can go through the Batch API at half price). Prompt rules:
- Reason about the **typical institutional recipe** first (list likely ingredients), then map to allergens.
- **Asymmetric instruction:** if a common preparation includes the allergen → `contains` or
  `may_contain`. `free` only when the allergen is absent from essentially all standard preparations.
- Hidden sources must be considered: soy sauce → soy+wheat, pesto → tree nuts (pine nut)/milk, Worcestershire →
  fish, roux/breading → wheat, butter finishes → milk, wine in sauces → alcohol, lard/bacon in beans → pork.
- **Branded names** ("Kettle Cuisine New England Clam Chowder", "Grandy Oats …", "Dole …"): the model
  gets a `webSearch` tool to look up the manufacturer's allergen statement and must cite the URL.
- Output: likely ingredients, per-allergen `{status, confidence, reason}`, diets, flags (fried?), `isFood`.

**Step 4. Second opinion.** Run Step 3 twice (different temperature or a second model). **Merge
conservatively:** per allergen take the more severe status (`contains` > `may_contain` > `unknown` >
`free`). Any `free` vs `contains` disagreement → `needs_review`.

**Step 5. Deterministic safety floor + consistency checks** (pure code, unit-tested):
- Keyword → minimum status. `cheese|cream|butter|alfredo|queso` → milk (unless `vegan|non dairy|cheeze`);
  `shrimp|crab|lobster|clam|scallop|mussel` → shellfish; `bacon|ham|pork|pepperoni|chorizo` → pork;
  `sausage` → pork `may_contain`; `tofu|edamame|tamari|soy` → soy; `sesame|tahini` → sesame;
  `pasta|bread|bun|roll|tortilla|breaded|fried|noodle|dumpling` → wheat/gluten `may_contain`, softened by
  `gf|gluten free|rice noodle|corn tortilla`; `peanut|satay` → peanuts; `pesto|almond|walnut|pecan|cashew` → tree nuts.
- Consistency: vegan ⇒ milk/egg/fish/shellfish/pork `free` (if violated → vegan becomes `may_contain`);
  tree-nut sub-tags roll up to `tree_nuts`; wheat ⇒ gluten.
- The floor **only raises** severity. Rule hits are recorded in `reasoning` for auditability.

**Step 6. Persist** an append-only `allergen_profiles` row with `model`, `prompt_version`, and inputs hash.
Bumping `prompt_version` re-queues foods (oldest-first) for re-research.

Cost/latency: the one-time backfill is ~926 foods × 2 calls (a few thousand tokens each), run once as a
local script (`pnpm research:backfill`), and after that it's small weekly deltas. Because results are
cached by name, the strongest model is affordable.

### 6.5 Human verification loop (Phase 3, the path to *Verified*)

- **Station-card photos:** a user at the hall taps "Add station card photo". A vision model extracts
  item name + allergen icons into a `reports` row; an admin approves it → `station_card` profile scoped
  to that hall. This is real Cornell ground truth.
- **"This is wrong" reports** with claimed allergens → admin queue.
- **Admin page** (`/admin`, behind auth): `needs_review` foods, reports, unclassified stations, alias
  suggestions, hall policy toggles.

---

## 7. Frontend

- **Onboarding (first visit):** chips for allergens (with tree-nut sub-types) and diets, plus a strict-mode
  toggle. Saved in `localStorage` (no accounts needed for v1; dietary info never leaves the device).
- **Home / "Today":** a meal switcher (defaults to the current/next meal from the timestamps) and hall
  cards grouped by campus area (North/West/Central) showing open hours and **"18 items fit · 9 to check"**.
  Sorted by number of fits.
- **Hall page** `/halls/morrison-dining?date=2026-11-20&meal=dinner`: station sections in `sortIdx` order;
  each item shows its bucket badge and source chip; "N hidden (contains milk)" collapsed per station.
- **Item drawer:** allergen grid with status + reason ("Typically made with soy sauce → soy, wheat"),
  likely ingredients, source + date, other halls serving it today, report button, disclaimer.
- **Search:** "Where can I get something vegan with no sesame tonight?" → items across halls.
- Mobile-first (people check in line), fast (RSC + cached data), accessible (badges use text + icon, not
  color alone). PWA later.
- Rendering: server components fetch the day's menu + profiles (cached, revalidated by ingest), and
  a small client component applies the user's filters. Pages stay fully cacheable because filtering is
  per-user client-side.

---

## 8. Tech stack & layout

| Concern | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | RSC caching fits "data changes hourly"; one codebase for site, crons, admin |
| Hosting/cron | **Vercel** (Cron Jobs, Fluid Compute) | Zero-ops crons for ingest/research |
| DB | **Postgres**: Neon `cornell-dining-db` (us-east-1, via Vercel Marketplace) in prod, Docker locally, + **Drizzle** | Relational menu data + `jsonb` profiles; `pgvector` available for retrieval |
| LLM | **Anthropic SDK** (`@anthropic-ai/sdk`), Claude Sonnet 5.5 by default, structured output + zod | Direct API with Batch support for the backfill; model is one setting (`RESEARCH_MODEL`) |
| UI | Tailwind + shadcn/ui | Fast, accessible primitives |
| Tests | Vitest (parsers, normalization, keyword floor, resolution), Playwright (smoke) | Safety logic must be unit-tested |

```
app/
  page.tsx                         # Today
  halls/[slug]/page.tsx
  foods/[id]/page.tsx
  search/page.tsx
  admin/...                        # Phase 3
  api/cron/ingest/route.ts
  api/cron/netnutrition/route.ts
  api/cron/research/route.ts
  api/reports/route.ts
lib/
  cornell/dining-api.ts            # fetch + zod schema for eateries.json
  cornell/netnutrition.ts          # session crawler + label parser
  ingest/{scope,normalize,upsert}.ts
  allergens/{taxonomy,keyword-floor,consistency,resolve,buckets,policies}.ts
  research/{context,retrieve,prompt,schema,run}.ts
  db/{schema,client}.ts
eval/
  build-gold-set.ts                # from netnutrition_items
  run-eval.ts                      # metrics report
fixtures/                          # real snapshots captured during research (already saved)
scripts/probe_netnutrition.py      # research probe (already saved)
```

---

## 9. Evaluation: prove the AI before trusting it

**Gold set:** the 521 NetNutrition items with official `Contains:` lines (retail-skewed), plus ~100
dining-hall items hand-labeled from station-card photos as soon as possible.

Run the research pipeline **blind on names only** (+ synthetic station context) and measure per allergen:

- **False-safe rate** (official contains X, we said `free`): *the* safety metric.
  Target: **< 1% for each of the 9 major allergens + gluten** at the "Fits" threshold.
- **Recall** of `contains ∪ may_contain` vs official contains.
- **Over-flag rate** (we flagged, official didn't). If everything is "Check", the app is useless.
- Calibration: does confidence ≥ threshold actually predict correctness? Tune the "Fits" threshold from this.

Gate: the AI-only "Fits" bucket ships only once the false-safe target is met. Until then, *Estimated*
items show as "Check at station" in all modes. The eval runs in CI on prompt changes.

---

### Results (2026‑11‑23, `npm run eval`, files in `eval/results/`)

Blind (dish name + café only), 2 runs merged + keyword floor + consistency, "fits" = free with
confidence ≥ 0.8, scored against Cornell's `Contains:` lines.

| Run | Model | Dishes | False "fits" / Cornell-positive cases | 9 major allergens + gluten | Cost |
|---|---|---|---|---|---|
| prompt v1, seed 1 | Sonnet 5.5 | 100 | 7 / 380 (1.8%) | 0 | $1.56 |
| prompt v1, seed 1 | Opus 5.5 | 100 | 6 / 380 (1.6%) | 1 (soy) | $4.18 |
| prompt v2, seed 1 (tuned on) | Sonnet 5.5 | 100 | 1 / 380 (0.3%) | 0 | $1.67 |
| **prompt v2, held-out seed 2** | **Sonnet 5.5** | 100 | **2 / 417 (0.5%)** | **0** | $1.70 |
| prompt v2, held-out seed 2 | Opus 5.5 | 100 | 1 / 417 (0.2%) | 0 | $4.33 |

- v1 misses were almost all **Cornell conventions** the prompt didn't know: Cornell labels *alcohol* for wine
  vinegar/balsamic and vanilla extract (19% of its labels), and *coconut* for coconut oil in plant-based
  cheeses/spreads and GF/vegan baked goods. v2 adds both (prompt + floor).
- Remaining held-out misses are one dish, "Godiva Chocolate Cheesecake" (pork — gelatin; coconut). A
  gelatin-dessert floor rule (pork `may_contain`) was added afterwards, so that dish is now caught but was
  seen during the held-out run; branded commercial desserts remain the riskiest category (web lookup of the
  manufacturer's allergen statement is the planned fix).
- **Decision: Sonnet 5.5.** Same safety as Opus within noise (same single dish missed), ~2.5× cheaper.
- Usefulness is the open problem, not safety: ~56–59% of Cornell-negative allergen cases are shown as
  "fits"; soy (8–15%) and milk (~40%) are flagged "may contain" very often. Improve with station-card
  verification (Phase 3) rather than by loosening the model.
- Caveats: rare allergens have small counts (shellfish 0–3 positives, coconut 8–10); the gold set is retail
  café food, not dining-hall food; Cornell's own labels have errors (§12).

## 10. Roadmap

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Foundations** (1–2 days) | Next.js scaffold, DB schema, ingest cron, NetNutrition crawler; email Cornell Dining Nutrition about an official feed | A week of menus in Postgres, re-ingest is idempotent, NetNutrition table populated |
| **1. Research + eval** | Research worker, keyword floor, resolution, eval harness; backfill ~926 foods | False-safe < 1% on the gold set; every in-scope food has a profile |
| **2. MVP site** | Onboarding, Today, Hall, Item drawer, disclaimers, strict mode | You can pick "no milk, no sesame" and see tonight's options in all 10 halls on a phone |
| **3. Verification** | Admin queue, reports, station-card photo extraction, hall policies UI | A growing share of items is *Verified* |
| **4. Expand** | Late Lunch/Late Night, salad bar, desserts, cafés (NetNutrition covers these officially), "notify me when Morrison has X", PWA | — |

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Wrong "fits" for someone with a severe allergy** | Conservative merge + keyword floor + eval gate + strict mode + "never say safe" + persistent disclaimers + links to Dining Nutrition/INDIGO |
| Undocumented API moves/changes (already happened once) | Content-type + zod validation, last-good fallback, alerting, raw snapshots for quick re-mapping |
| NetNutrition HTML changes | Parser fixture tests; it's weekly and non-critical (only degrades to AI) |
| Same name, different recipe across halls | Hall-scoped profiles + hall policies; station cards are per hall |
| Placeholders / daily specials ("Chef's Choice") | Always "Check at station" |
| Cross-contact (shared fryers, shared equipment) | `shared_fryer` flag + generic cross-contact note; Risley's certified environment highlighted |
| Stale hall policies (2023 news) | Policies need a citation + `verifiedAt`; disabled until re-verified |
| Being a bad citizen to Cornell servers | Hourly menu fetch, weekly NetNutrition crawl with delays, generic User-Agent, cache everything |

## 12. Lessons from building Phase 0 (2026‑11‑20 → 23)

- **Menus change after publication.** A re-ingest 3 days later found 14 already-published meals edited
  and 97 new food names (Thanksgiving week). Hourly ingest + content hashing is justified.
- **Closures arrive as data, not as missing meals.** Two shapes seen: a `* Announcements *` section whose
  only item is `Closed`, and `Closed` as the only item under a normal station (North Star "Create").
  Both are stored as `meal_events.notices`, never as foods. (`INGEST_LOGIC_VERSION` forces a rewrite of
  stored events when this kind of logic changes.)
- **NetNutrition rejects Node's default `Accept-Language: *`** with a "Start-up Error" page. The crawler
  always sends `en-US`. It also had a mid-crawl outage, so the crawler now retries with backoff, trips a
  circuit breaker after 5 consecutive failures, and only prunes after a complete, error-free crawl.
- Unknown station names are surfaced (status page + `stations.kind = 'unclassified'`), never silently dropped.
- **Official labels are imperfect.** Full crawl: 647 labels / 520 names, 188 without a `Contains:` line.
  Most of those are genuinely allergen-free (beans, quinoa, spinach), but "Sour Cream" lists milk in its
  ingredients with no `Contains:` line, and 5 names carry different allergen sets at different cafés. →
  union across labels, and a missing `Contains:` line never means `free` (§6.4 Step 1).
- NetNutrition `detailOid`s are per-listing and change over time (the same food has several IDs, and new IDs
  week to week), so foods are matched by normalized name. Listing headers ("BURGER TOPPINGS:") are filtered out.

## 13. Open questions for you

1. **Accounts?** v1 assumes none (localStorage). Accounts would enable notifications and synced prefs.
2. **Who is admin?** Needed for Phase 3 review (simple auth: a single password or Cornell NetID SSO later).
3. **Cornell outreach:** are you comfortable contacting Cornell Dining for an official data feed? It's the
   single biggest accuracy win available.
