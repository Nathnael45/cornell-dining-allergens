CREATE TABLE "allergen_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL,
	"eatery_id" integer,
	"source" text NOT NULL,
	"source_ref" text,
	"allergens" jsonb NOT NULL,
	"diets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"likely_ingredients" text[],
	"reasoning" text,
	"model" text,
	"prompt_version" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eateries" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"campus_area" text,
	"is_dining_room" boolean DEFAULT false NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"raw_nutrition_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eateries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "food_aliases" (
	"alias_key" text PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"display_name" text NOT NULL,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"research_status" text DEFAULT 'pending' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "hall_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"eatery_id" integer NOT NULL,
	"station_pattern" text,
	"allergen" text NOT NULL,
	"effect" text NOT NULL,
	"citation_url" text NOT NULL,
	"verified_at" date,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "meal_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eatery_id" integer NOT NULL,
	"service_date" date NOT NULL,
	"meal" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"cal_summary" text,
	"content_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"meal_event_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"station_sort_idx" integer DEFAULT 0 NOT NULL,
	"sort_idx" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "menu_items_meal_event_id_station_id_food_id_pk" PRIMARY KEY("meal_event_id","station_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "netnutrition_items" (
	"detail_oid" integer PRIMARY KEY NOT NULL,
	"unit_name" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"serving_size" text,
	"ingredients" text,
	"has_contains_line" boolean NOT NULL,
	"contains_raw" text[] NOT NULL,
	"allergens" text[] NOT NULL,
	"unmapped_allergens" text[] NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer,
	"eatery_id" integer,
	"kind" text NOT NULL,
	"claimed" jsonb,
	"note" text,
	"photo_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"food_id" integer PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"in_scope" boolean NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "allergen_profiles" ADD CONSTRAINT "allergen_profiles_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allergen_profiles" ADD CONSTRAINT "allergen_profiles_eatery_id_eateries_id_fk" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hall_policies" ADD CONSTRAINT "hall_policies_eatery_id_eateries_id_fk" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_events" ADD CONSTRAINT "meal_events_eatery_id_eateries_id_fk" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_meal_event_id_meal_events_id_fk" FOREIGN KEY ("meal_event_id") REFERENCES "public"."meal_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_eatery_id_eateries_id_fk" FOREIGN KEY ("eatery_id") REFERENCES "public"."eateries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allergen_profiles_food" ON "allergen_profiles" USING btree ("food_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_events_natural_key" ON "meal_events" USING btree ("eatery_id","service_date","meal","starts_at");--> statement-breakpoint
CREATE INDEX "meal_events_date" ON "meal_events" USING btree ("service_date");--> statement-breakpoint
CREATE INDEX "menu_items_food" ON "menu_items" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "netnutrition_items_name_key" ON "netnutrition_items" USING btree ("name_key");