# Cornell Dining Allergen Finder

See **what you can actually eat in each Cornell dining hall today**, filtered by your allergies and diet.

**Live: <https://cornell-dining-allergens.vercel.app>**

Cornell's dining menu API only gives dish *names*. Official allergen labels exist for retail cafés, but
almost never for the dining halls' main lines. This app fills that gap: every time a new dish shows up
on a Cornell menu, it gets researched **once**. The result is stored in Postgres and reused every day
after that.

## What it does

- **Every hall, every meal.** Menus come from Cornell's dining API three times a day. Halls are grouped
  by campus (North, West, Central), with day and meal switches and shareable URLs.
- **Pick your restrictions.** Choose from the 9 major allergens plus gluten, Cornell's extra labels
  (coconut, pork, alcohol), and vegetarian or vegan. Every dish lands in one of three buckets:
  - **Fits**: researched as free of everything you picked, with high confidence.
  - **Check**: uncertain, or "may contain".
  - **Avoid**: contains something you picked.

  The site never says "safe", and a strict mode only trusts Cornell-verified information.
- **"How many real options do I have?"** For each hall, meal and set of restrictions, it counts the
  *main dishes* that fit (sides, sauces and drinks don't count) and rates them *plenty*, *some*,
  *limited* or *none*.
- **Gluten-free likelihood.** A recipe-based guess for each dish: *definitely*, *likely*, *less likely*
  or *unlikely*. Cornell's official labels and hall policies override it; for example, Risley is a
  gluten-free kitchen.
- **Works on phones.** Wide screens get a sidebar. Phones get a bottom sheet for restrictions and a hall
  switcher strip.

## How it works

```
Cornell Dining API ──► ingest (3×/day) ──► Postgres (Neon)
                                               ▲
Cornell NetNutrition labels ──► crawler ───────┤  official "Contains:" lines (can only add caution)
                                               │
new, never-seen dish ──► Claude research ──────┘  2 samples merged conservatively
                         + keyword floor               (e.g. "pasta" ⇒ wheat/gluten no matter what)
                         + consistency rules           (wheat ⇒ gluten, vegan ⇒ no milk/egg…)
                         + hall policies               (Risley GF/nut-free, 104West! kosher, halal/kosher stations)
```

- **Research once, reuse forever.** Each distinct dish is normalized to an identity key, so "Chef's
  Choice Pasta" at three halls is one database row. Profiles are append-only and versioned, and each
  allergen carries a status (contains / may contain / free / unknown) with a confidence, a reason
  and a source.
- **Conservative by construction.** Runs merge toward the more cautious answer. A deterministic
  keyword floor can only raise severity. A missing official label never counts as "free".
- **Measured before trusted.** `npm run eval` scores the model blind (dish name only) against
  Cornell's official labels. On a held-out set, Claude Sonnet 5.5 had **2 false "fits" out of 417**
  allergen-positive cases, and **0** for the 9 major allergens plus gluten
  (details in [ARCHITECTURE.md §9](./ARCHITECTURE.md)).
- **Cheap to run.** About $0.02 per new dish. Researching all ~700 dishes cost about $24, evals
  included. Ongoing cost is about $1–3 a month on free Vercel and Neon plans, and there is an
  [on/off switch](#on--off-switch-save-api-usage).

The full design, data model, eval results and lessons learned are in **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

> This is a student project, not affiliated with Cornell Dining. AI research can be wrong. If you have a
> serious allergy, confirm with the staff at the station or the Dining Nutrition Office
> (diningnutrition@cornell.edu).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind · Postgres via Drizzle ORM (Neon in
production; PGlite in tests) · Anthropic Claude API (structured outputs) · Vercel (hosting + cron) ·
Vitest.

## Quick start

Requires Node 24+ and Docker.

```bash
npm install
cp .env.example .env.local        # set CRON_SECRET (any long random string) and ANTHROPIC_API_KEY
npm run db:up                     # local Postgres on :5433
npm run db:migrate
npm run ingest                    # pull live menus from Cornell (~2s)
npm run netnutrition              # crawl Cornell's official labels (~5–8 min, polite pace)
npm run research 20               # research 20 new dishes with Claude (~$0.40)
npm run dev                       # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run ingest` | Fetch the live Cornell Dining API and upsert menus (idempotent) |
| `npm run ingest:file <path>` | Ingest a saved snapshot, e.g. `fixtures/eateries-2026-11-20.json` |
| `npm run netnutrition` | Crawl NetNutrition labels (ingredients + official "Contains:") |
| `npm run research [n]` | Research up to *n* queued dishes (allergens, gluten-free rating, dish role) |
| `npm run gluten` / `npm run roles` | Backfill gluten-free ratings / main-vs-side roles |
| `npm run eval` / `npm run eval:gluten` | Score the model against Cornell's official labels |
| `npm test` | Unit + integration tests (in-memory Postgres via PGlite, no Docker needed) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration after editing `lib/db/schema.ts` |

Each has a `prod:*` twin that targets production (see below).

## Layout

```
app/page.tsx, app/halls/[slug]   day view: all halls, or one hall's menu
app/api/cron/*                   scheduled ingest / research / NetNutrition (Bearer CRON_SECRET)
app/api/foods/[id]               per-dish detail (reasons, sources)
components/                      restriction picker, hall list, menu, options rating
lib/cornell/                     Dining API client (zod-validated) + NetNutrition crawler
lib/ingest/                      scope ("main meal" stations), name normalization, ingest
lib/research/                    Claude prompts, schemas, worker, gluten-free + role classifiers
lib/allergens/                   taxonomy, keyword floor, merge rules, hall policies, buckets
lib/db/, drizzle/                Drizzle schema + SQL migrations
eval/                            model evals and saved results
fixtures/, tests/                real API snapshots + vitest suites
```

## Production

- Vercel project: `cornell-dining-allergens` (linked via `vercel link`; `.vercel/` is git-ignored).
- Database: Neon `cornell-dining-db` (free plan, us-east-1), provisioned through the Vercel Marketplace,
  which injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into every environment.
- Secrets in Vercel: `CRON_SECRET` (production). `ANTHROPIC_API_KEY` must be added before the research
  worker is deployed: `vercel env add ANTHROPIC_API_KEY production`.

Local development uses Docker Postgres via `.env.local`. To operate on production from your machine,
pull its env into a separate, git-ignored file and use the `prod:*` scripts, which load only that file:

```bash
vercel env pull .env.neon --environment production --yes
npm run prod:migrate        # applies migrations over the direct (unpooled) connection
npm run prod:ingest         # live menu ingest into Neon
npm run prod:netnutrition   # label crawl into Neon
```

Every CLI command prints the database host it is about to touch (`[db] …`), never credentials.

Scheduled jobs (`vercel.json`, Hobby plan = each cron at most once a day, 5-minute functions):
menu ingest and new-food research run 3× daily (4am, 10am, 4pm Ithaca time, as UTC 09/15/21h).
The NetNutrition crawl takes ~7 minutes, too long for a Hobby function, so run it by hand every few
weeks: `npm run prod:netnutrition` (the route `/api/cron/netnutrition` stays for a Pro plan).

## On / off switch (save API usage)

```bash
npm run prod:pause     # site shows "Paused"; scheduled jobs skip their work (no Anthropic calls)
npm run prod:resume    # back on: fetches fresh menus now (free) and tells you how many foods await
                       # research and the rough cost; research runs at the next scheduled slot,
                       # or immediately with: npm run prod:research <n>
npm run prod:paused    # show the current state
```

The switch lives in the database (`app_settings`), so it takes effect immediately, with no redeploy.

## AI

`npm run ai:check` sends one tiny request (~$0.001) to confirm `ANTHROPIC_API_KEY` works.
The research model defaults to Claude Sonnet 5.5 (`lib/research/config.ts`); override per run with
`RESEARCH_MODEL=claude-opus-5-5`.
