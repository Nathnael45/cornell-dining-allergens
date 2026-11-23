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

## Deploying

Designed for Vercel: set `DATABASE_URL` (hosted Postgres, e.g. Neon) and `CRON_SECRET`, run
`npm run db:migrate` against that database once, and the crons in `vercel.json` take over.
