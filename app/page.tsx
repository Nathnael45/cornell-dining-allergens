import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { getStatus } from "@/lib/status";

/**
 * Phase 0 status page: is the pipeline healthy, and what's in the database today?
 * The real user-facing UI arrives in Phase 2 (ARCHITECTURE.md §7).
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Cornell Dining Allergen Finder</h1>
      <p className="mt-1 text-sm opacity-70">Phase 0 — data pipeline status. Not for dietary decisions yet.</p>
      <Suspense fallback={<p className="mt-8 opacity-60">Loading status…</p>}>
        <Status />
      </Suspense>
    </main>
  );
}

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) : "—";
const time = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

async function Status() {
  await connection(); // always render at request time — this page reports live pipeline state
  let s: Awaited<ReturnType<typeof getStatus>>;
  try {
    s = await getStatus(getDb());
  } catch (e) {
    return (
      <p className="mt-8 rounded border border-red-500/40 bg-red-500/10 p-4 text-sm">
        Database unavailable: {(e as Error).message}. Run <code>npm run db:up && npm run db:migrate</code>.
      </p>
    );
  }

  const byHall = new Map<number, { name: string; area: string | null; meals: typeof s.halls }>();
  for (const row of s.halls) {
    const h = byHall.get(row.id) ?? { name: row.name, area: row.area, meals: [] };
    h.meals.push(row);
    byHall.set(row.id, h);
  }

  return (
    <>
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {(["menus", "netnutrition"] as const).map((kind) => {
          const run = s.lastRuns.find((r) => r.kind === kind);
          const ok = run?.status === "ok";
          return (
            <div key={kind} className="rounded-lg border border-current/15 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{kind === "menus" ? "Menu ingest (hourly)" : "NetNutrition sync (weekly)"}</h2>
                <span className={`rounded px-2 py-0.5 text-xs ${ok ? "bg-green-600/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                  {run ? run.status : "never run"}
                </span>
              </div>
              <p className="mt-1 text-sm opacity-70">Last run: {fmt(run?.finishedAt ?? run?.startedAt ?? null)}</p>
              {run?.error && <p className="mt-1 line-clamp-2 text-xs text-red-600">{run.error}</p>}
            </div>
          );
        })}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Unique foods", s.counts.foods],
          ["Placeholders", s.counts.placeholders],
          ["Awaiting research", s.counts.researchQueue],
          ["Cornell labels", s.counts.netnutritionLabels],
          ["Foods w/ official label", s.counts.foodsWithOfficialLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-current/15 p-3">
            <div className="text-xl font-semibold tabular-nums">{value}</div>
            <div className="text-xs opacity-70">{label}</div>
          </div>
        ))}
      </section>

      {s.unclassified.length > 0 && (
        <p className="mt-6 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          New station names need classifying in <code>lib/ingest/scope.ts</code>: {s.unclassified.join(", ")}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium">Today ({s.date}) — main-meal items per hall</h2>
        {byHall.size === 0 ? (
          <p className="mt-2 text-sm opacity-70">No meals found for today. Run <code>npm run ingest</code>.</p>
        ) : (
          <ul className="mt-3 divide-y divide-current/10 rounded-lg border border-current/15">
            {[...byHall.values()].map((h) => (
              <li key={h.name} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {h.name} <span className="text-xs opacity-60">{h.area}</span>
                </span>
                <span className="flex flex-wrap gap-2 text-xs">
                  {h.meals.map((m) => (
                    <span key={m.meal + m.startsAt.toISOString()} className="rounded bg-current/5 px-2 py-1 tabular-nums">
                      {m.meal} {time(m.startsAt)}–{time(m.endsAt)} · {m.items} items
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
