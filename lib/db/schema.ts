/**
 * Database schema. See ARCHITECTURE.md §5 for the reasoning behind each table.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const eateries = pgTable("eateries", {
  id: integer("id").primaryKey(), // Cornell's own id (e.g. 43 = Morrison)
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  campusArea: text("campus_area"),
  isDiningRoom: boolean("is_dining_room").notNull().default(false),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  rawNutritionNote: text("raw_nutrition_note"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type StationKind =
  | "main"
  | "side"
  | "soup"
  | "salad"
  | "dessert"
  | "beverage"
  | "condiment"
  | "breakfast_cold"
  | "announcement" // "* Announcements *" sections, e.g. item "Closed" — stored as meal notices, not foods
  | "unclassified";

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // exactly as Cornell names it: "Chef's Table - Sides"
  kind: text("kind").$type<StationKind>().notNull(),
  inScope: boolean("in_scope").notNull(),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
});

export const mealEvents = pgTable(
  "meal_events",
  {
    id: serial("id").primaryKey(),
    eateryId: integer("eatery_id")
      .notNull()
      .references(() => eateries.id),
    serviceDate: date("service_date").notNull(),
    meal: text("meal").notNull(), // "Breakfast" | "Lunch" | ... ("" normalized to "Other")
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    calSummary: text("cal_summary"),
    /** Text from announcement sections, e.g. ["Closed"]. */
    notices: text("notices").array().notNull().default(sql`'{}'::text[]`),
    contentHash: text("content_hash").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("meal_events_natural_key").on(t.eateryId, t.serviceDate, t.meal, t.startsAt),
    index("meal_events_date").on(t.serviceDate),
  ],
);

export type ResearchStatus = "pending" | "researching" | "done" | "needs_review" | "failed";

export const foods = pgTable("foods", {
  id: serial("id").primaryKey(),
  nameKey: text("name_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  researchStatus: text("research_status").$type<ResearchStatus>().notNull().default("pending"),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
});

/** Manual merges only — we never fuzzy-merge automatically (allergen safety). */
export const foodAliases = pgTable("food_aliases", {
  aliasKey: text("alias_key").primaryKey(),
  foodId: integer("food_id")
    .notNull()
    .references(() => foods.id),
});

export const menuItems = pgTable(
  "menu_items",
  {
    mealEventId: integer("meal_event_id")
      .notNull()
      .references(() => mealEvents.id, { onDelete: "cascade" }),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id),
    foodId: integer("food_id")
      .notNull()
      .references(() => foods.id),
    stationSortIdx: integer("station_sort_idx").notNull().default(0),
    sortIdx: integer("sort_idx").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.mealEventId, t.stationId, t.foodId] }),
    index("menu_items_food").on(t.foodId),
  ],
);

export type ProfileSource = "station_card" | "human_review" | "hall_policy" | "cornell_official" | "ai";

/** Append-only. Exactly one is_current row per (food, eatery scope, source). */
export const allergenProfiles = pgTable(
  "allergen_profiles",
  {
    id: serial("id").primaryKey(),
    foodId: integer("food_id")
      .notNull()
      .references(() => foods.id),
    eateryId: integer("eatery_id").references(() => eateries.id), // null = applies everywhere
    source: text("source").$type<ProfileSource>().notNull(),
    sourceRef: text("source_ref"),
    allergens: jsonb("allergens").notNull(),
    diets: jsonb("diets").notNull().default(sql`'{}'::jsonb`),
    flags: jsonb("flags").notNull().default(sql`'{}'::jsonb`),
    likelyIngredients: text("likely_ingredients").array(),
    reasoning: text("reasoning"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("allergen_profiles_food").on(t.foodId, t.isCurrent)],
);

export const netnutritionItems = pgTable(
  "netnutrition_items",
  {
    detailOid: integer("detail_oid").primaryKey(),
    unitName: text("unit_name").notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    servingSize: text("serving_size"),
    ingredients: text("ingredients"),
    // A label with no "Contains:" line is NOT evidence of "allergen-free": on 2026-11-23 Cornell's
    // own "Sour Cream" label had no Contains line while its ingredients list cream and milk.
    // Phase 1 treats such labels as ingredients-only evidence (keyword floor + AI), never as `free`.
    hasContainsLine: boolean("has_contains_line").notNull(),
    containsRaw: text("contains_raw").array().notNull(), // exactly as printed: ["Egg", "Gluten", ...]
    allergens: text("allergens").array().notNull(), // mapped to our taxonomy keys
    unmappedAllergens: text("unmapped_allergens").array().notNull(), // printed names we don't know yet
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("netnutrition_items_name_key").on(t.nameKey)],
);

export const hallPolicies = pgTable("hall_policies", {
  id: serial("id").primaryKey(),
  eateryId: integer("eatery_id")
    .notNull()
    .references(() => eateries.id),
  stationPattern: text("station_pattern"), // null = whole hall
  allergen: text("allergen").notNull(),
  effect: text("effect").$type<"free">().notNull(),
  citationUrl: text("citation_url").notNull(),
  verifiedAt: date("verified_at"),
  enabled: boolean("enabled").notNull().default(false),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  foodId: integer("food_id").references(() => foods.id),
  eateryId: integer("eatery_id").references(() => eateries.id),
  kind: text("kind").$type<"wrong_allergen" | "station_card_photo" | "other">().notNull(),
  claimed: jsonb("claimed"),
  note: text("note"),
  photoUrl: text("photo_url"),
  status: text("status").$type<"open" | "accepted" | "rejected">().notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<"menus" | "netnutrition">().notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  status: text("status").$type<"running" | "ok" | "error">().notNull().default("running"),
  stats: jsonb("stats"),
  error: text("error"),
});

/** Work queue for the allergen research worker (Phase 1). */
export const researchJobs = pgTable("research_jobs", {
  foodId: integer("food_id")
    .primaryKey()
    .references(() => foods.id),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: ts("locked_at"),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
