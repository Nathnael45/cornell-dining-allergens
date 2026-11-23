import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/lib/db/client";
import { getPause, setPaused } from "@/lib/settings";
import { testDb } from "./helpers/db";

let db: DB;
let close: () => Promise<void>;
beforeEach(async () => ({ db, close } = await testDb()));
afterEach(async () => close());

describe("pause switch", () => {
  it("defaults to running, and toggles both ways", async () => {
    expect((await getPause(db)).paused).toBe(false);
    await setPaused(db, true);
    const p = await getPause(db);
    expect(p.paused).toBe(true);
    expect(p.since).toMatch(/^\d{4}-/);
    await setPaused(db, false);
    expect((await getPause(db)).paused).toBe(false);
  });
});
