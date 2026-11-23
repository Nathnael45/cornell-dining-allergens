import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/** Fresh in-memory Postgres with all migrations applied. */
export async function testDb(): Promise<{ db: DB; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as DB, close: () => client.close() };
}
