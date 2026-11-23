import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** Driver-agnostic handle so the same code runs on node-postgres (app) and PGlite (tests). */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __diningPool?: Pool };

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return new Pool({
    connectionString: url,
    max: 5,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  });
}

let cached: DB | undefined;

export function getDb(): DB {
  if (!cached) {
    // Reuse the pool across hot reloads in dev.
    const pool = (globalForDb.__diningPool ??= makePool());
    cached = drizzle(pool, { schema }) as unknown as DB;
  }
  return cached;
}

export async function closeDb() {
  await globalForDb.__diningPool?.end();
  globalForDb.__diningPool = undefined;
  cached = undefined;
}

export { schema };
