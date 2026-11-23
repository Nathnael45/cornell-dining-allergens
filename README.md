# Cornell Dining Allergen Finder

See what you can eat in each Cornell dining hall, filtered by allergen and diet.
Design and roadmap: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

**Status: Phase 0 (data pipeline).** Menus and Cornell's official NetNutrition labels are ingested
into Postgres; allergen research (Phase 1) and the user-facing site (Phase 2) come next.
Nothing here should be used for dietary decisions yet.

## Quick start

Requires Node 24+ and Docker.

```bash
npm install
cp .env.example .env.local        # then set CRON_SECRET to a long random string
npm run db:up                     # local Postgres on :5433
npm run db:migrate
npm run ingest                    # pull live menus from Cornell (~2s)
npm run netnutrition              # crawl Cornell's official labels (~5–8 min, polite pace)
npm run dev                       # http://localhost:3000 — pipeline status page
```

## Scripts

| Command | What it does |
|---|---|
| `npm run ingest` | Fetch the live Cornell Dining API and upsert menus (idempotent) |
| `npm run ingest:file <path>` | Ingest a saved snapshot, e.g. `fixtures/eateries-2026-11-20.json` |
| `npm run netnutrition` | Crawl NetNutrition labels (ingredients + official "Contains:") |
| `npm test` | Unit + integration tests (in-memory Postgres via PGlite, no Docker needed) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration after editing `lib/db/schema.ts` |

## Layout

```
app/page.tsx                    pipeline status page (Phase 0)
app/api/cron/ingest             hourly menu ingest (Vercel Cron, Bearer CRON_SECRET)
app/api/cron/netnutrition       weekly NetNutrition sync
lib/cornell/dining-api.ts       Cornell Dining API client + zod validation
lib/cornell/netnutrition.ts     NetNutrition session crawler, label parser, circuit breaker
lib/ingest/                     scope (what counts as "main meal"), name normalization, ingest
lib/allergens/taxonomy.ts       Cornell's allergen list + label-name mapping
lib/db/                         Drizzle schema + client
drizzle/                        SQL migrations
fixtures/                       real API snapshots used by tests
tests/                          vitest suites
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

## AI

`npm run ai:check` sends one tiny request (~$0.001) to confirm `ANTHROPIC_API_KEY` works.
The research model defaults to Claude Sonnet 5.5 (`lib/research/config.ts`); override per run with
`RESEARCH_MODEL=claude-opus-5-5`.
