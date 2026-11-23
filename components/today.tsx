"use client";
import Link from "next/link";
import { useMemo } from "react";
import { rateOptions, verdict, type OptionsRating, type Prefs } from "@/lib/allergens/buckets";
import { OptionsBadge, OptionsDot, optionsLine } from "./options";
import type { Hall } from "@/lib/menu";
import { usePrefs } from "./prefs";
import { time } from "./day-nav";

type Row = {
  h: Hall;
  m: Hall["meals"][number] | undefined;
  total: number;
  counts: { fits: number; check: number; avoid: number };
  /** Main dishes that fit (null when not filtering or not serving). */
  options: OptionsRating | null;
  /** null when serving; otherwise why not ("Not open this day", "No dinner this day", "Closed for dinner"). */
  off: string | null;
};

export const AREAS = ["North", "West", "Central"];

/** Every dining hall with fit counts for the reader, grouped by campus and ranked within each group. */
function useGroups(halls: Hall[], meal: string, prefs: Prefs | null) {
  const filtering = !!prefs && prefs.avoid.length + prefs.diets.length > 0;
  const groups = useMemo(() => {
    const rows: Row[] = halls.map((h) => {
      const m = h.meals.find((x) => x.meal === meal);
      const items = m ? m.stations.flatMap((s) => s.items) : [];
      const counts = { fits: 0, check: 0, avoid: 0 };
      if (prefs) for (const it of items) counts[verdict(it, prefs).bucket]++;
      const off = !h.meals.length
        ? "Not open this day"
        : !m
          ? `No ${meal.toLowerCase()} this day`
          : !items.length && m.notices.some((n) => /closed/i.test(n))
            ? `Closed for ${meal.toLowerCase()}`
            : null;
      const options = filtering && !off && prefs ? rateOptions(items, prefs) : null;
      return { h, m, total: items.length, counts, options, off };
    });
    // Within a campus: open halls first, then the most main dishes that fit, then the most items that fit.
    const rank = (a: Row, b: Row) =>
      Number(!!a.off) - Number(!!b.off) ||
      (b.options?.mains.length ?? 0) - (a.options?.mains.length ?? 0) ||
      (filtering ? b.counts.fits - a.counts.fits : 0) ||
      a.h.name.localeCompare(b.h.name);
    const areas = [...AREAS, ...new Set(rows.map((r) => r.h.area ?? "Other").filter((a) => !AREAS.includes(a)))];
    return areas.map((area) => ({ area, rows: rows.filter((r) => (r.h.area ?? "Other") === area).sort(rank) })).filter((g) => g.rows.length);
  }, [halls, meal, prefs, filtering]);
  return { groups, filtering };
}

const hallHref = (slug: string, date: string, meal: string) => `/halls/${slug}?date=${date}&meal=${meal.toLowerCase()}`;

/** Share of the menu that fits, as a ring. The number inside is the count of items that fit. */
function Ring({ fits, total, filtering }: { fits: number; total: number; filtering: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const share = filtering && total ? fits / total : 1;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--rule)" strokeWidth="6" />
        {share > 0 && (
          <circle cx="32" cy="32" r={r} fill="none" stroke={filtering ? "var(--fit)" : "var(--avoid)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${share * c} ${c}`} />
        )}
      </svg>
      <span className={`font-display text-[1.35rem] leading-none font-bold tabular-nums ${filtering ? "text-fit" : ""}`}>{filtering ? fits : total}</span>
    </div>
  );
}

/** Overview cards (main area), grouped by campus. */
export function HallList({ halls, meal, date }: { halls: Hall[]; meal: string; date: string }) {
  const prefs = usePrefs();
  const { groups, filtering } = useGroups(halls, meal, prefs);
  if (!groups.length) return <p className="py-10 text-muted">No dining halls found for this day.</p>;

  return (
    <>
      <h1 className="pt-6 font-display text-[1.6rem] font-bold">{filtering ? "Where you can eat" : `Dining halls, ${meal.toLowerCase()}`}</h1>
      <p className="text-[0.95rem] text-muted">{filtering ? "Grouped by campus, most options for you first." : "Choose what you avoid to see what fits."}</p>
      {groups.map((g) => (
        <section key={g.area} aria-labelledby={`area-${g.area}`} className="pt-6">
          <h2 id={`area-${g.area}`} className="mb-3 font-display text-[1.15rem] font-bold text-brand">
            {g.area} campus
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {g.rows.map(({ h, m, total, counts, options, off }) => (
              <li key={h.id}>
                <Link
                  href={hallHref(h.slug, date, meal)}
                  className={`flex h-full items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-rule transition-shadow hover:shadow-md ${off ? "opacity-60" : ""}`}
                >
                  {!off && <Ring fits={counts.fits} total={total} filtering={filtering} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[1.15rem] leading-tight font-bold">{h.name}</span>
                    <span className="mt-0.5 block text-[0.92rem] text-muted">{off ?? `${time(m!.startsAt)} to ${time(m!.endsAt)}`}</span>
                    {options && (
                      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <OptionsBadge level={options.level} />
                        <span className="text-[0.85rem] text-muted">{optionsLine(options)}</span>
                      </span>
                    )}
                    {!off && (
                      <span className="mt-2 flex flex-wrap gap-1.5 text-[0.83rem]">
                        {filtering ? (
                          <>
                            <span className="rounded-full bg-avoid-tint px-2 py-0.5 text-muted">{counts.fits} items fit</span>
                            {counts.check > 0 && <span className="rounded-full bg-check-tint px-2 py-0.5 text-check">{counts.check} to check</span>}
                            {counts.avoid > 0 && <span className="rounded-full bg-avoid-tint px-2 py-0.5 text-muted">{counts.avoid} not for you</span>}
                          </>
                        ) : (
                          <span className="rounded-full bg-avoid-tint px-2 py-0.5 text-muted">{total} items</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="text-[1.4rem] text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Compact hall list for the sidebar (wide screens), grouped by campus. */
export function HallNav({ halls, meal, date, selected }: { halls: Hall[]; meal: string; date: string; selected?: string }) {
  const prefs = usePrefs();
  const { groups, filtering } = useGroups(halls, meal, prefs);
  return (
    <nav aria-label="Dining halls">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-[1.2rem] font-bold">Dining halls</h2>
        <Link href={`/?date=${date}&meal=${meal.toLowerCase()}`} className={`text-[0.88rem] underline underline-offset-2 ${selected ? "text-muted" : "font-bold text-brand"}`}>
          Overview
        </Link>
      </div>
      {groups.map((g) => (
        <div key={g.area} className="mt-3">
          <h3 className="mb-1 pl-4 text-[0.82rem] font-bold text-muted">{g.area}</h3>
          <ul className="space-y-0.5">
            {g.rows.map(({ h, counts, total, options, off }) => {
              const on = h.slug === selected;
              return (
                <li key={h.id}>
                  <Link
                    href={hallHref(h.slug, date, meal)}
                    aria-current={on ? "page" : undefined}
                    title={off ?? undefined}
                    className={`flex items-center gap-2 rounded-lg border-l-4 py-1.5 pr-2 pl-3 text-[0.97rem] ${on ? "border-brand bg-brand-tint font-bold" : "border-transparent hover:bg-surface"} ${off ? "text-muted" : ""}`}
                  >
                    {options ? <OptionsDot level={options.level} /> : <span className="size-2.5 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{h.name}</span>
                    {off ? (
                      <span className="shrink-0 text-[0.8rem]">{off.startsWith("Not open") ? "closed" : "—"}</span>
                    ) : (
                      <span className={`rounded-full px-2 text-[0.82rem] font-bold tabular-nums ${filtering ? "bg-fit-tint text-fit" : "bg-avoid-tint text-muted"}`}>
                        {filtering ? counts.fits : total}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {filtering ? (
        <p className="mt-3 text-[0.82rem] text-muted">
          Dot = main-dish options for you (green plenty, amber limited, red none). Number = all items that fit. — = not serving this meal.
        </p>
      ) : (
        <p className="mt-3 text-[0.82rem] text-muted">— = not serving this meal.</p>
      )}
    </nav>
  );
}
