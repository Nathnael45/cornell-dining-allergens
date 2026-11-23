/**
 * On/off switch for the whole app (saves API usage when not needed).
 * Paused: scheduled jobs skip their work (no Anthropic calls) and the site shows a "paused" page.
 * Toggle with `npm run prod:pause` / `npm run prod:resume`; takes effect immediately, no redeploy.
 */
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

export type PauseState = { paused: boolean; since: string | null };

export async function getPause(db: DB): Promise<PauseState> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "paused"));
  return row ? { paused: (row.value as { on?: boolean }).on === true, since: row.updatedAt.toISOString() } : { paused: false, since: null };
}

export async function setPaused(db: DB, on: boolean) {
  const values = { key: "paused", value: { on }, updatedAt: new Date() };
  await db.insert(appSettings).values(values).onConflictDoUpdate({ target: appSettings.key, set: values });
}
