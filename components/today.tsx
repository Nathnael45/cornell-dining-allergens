"use client";
import Link from "next/link";
import { useMemo } from "react";
import { verdict, type Prefs } from "@/lib/allergens/buckets";
import type { Hall } from "@/lib/menu";
import { usePrefs } from "./prefs";
import { time } from "./day-nav";

type Row = { h: Hall; m: Hall["meals"][number]; total: number; counts: { fits: number; check: number; avoid: number }; closed: boolean };

/** Halls serving `meal`, with fit counts for the reader, ranked by how much fits. */
function useRows(halls: Hall[], meal: string, prefs: Prefs | null) {
  const filtering = !!prefs && prefs.avoid.length + prefs.diets.length > 0;
  const rows = useMemo(
    () =>
      halls
        .map((h): Row | null => {
          const m = h.meals.find((x) => x.meal === meal);
          if (!m) return null;
          const items = m.stations.flatMap((s) => s.items);
          const counts = { fits: 0, check: 0, avoid: 0 };
          if (prefs) for (const it of items) counts[verdict(it, prefs).bucket]++;
          const closed = items.length === 0 && m.notices.some((n) => /closed/i.test(n));
          return { h, m, total: items.length, counts, closed };
        })
        .filter((r) => r !== null)
        .sort((a, b) => Number(a.closed) - Number(b.closed) || (filtering ? b.counts.fits - a.counts.fits : 0) || a.h.name.localeCompare(b.h.name)),
    [halls, meal, prefs, filtering],
  );
  return { rows, filtering };
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

/** Overview cards (main area). */
export function HallList({ halls, meal, date }: { halls: Hall[]; meal: string; date: string }) {
  const prefs = usePrefs();
  const { rows, filtering } = useRows(halls, meal, prefs);
  if (!rows.length) return <p className="py-10 text-muted">No dining hall lists a {meal.toLowerCase()} menu for this day.</p>;

  return (
    <>
      <h1 className="pt-6 font-display text-[1.6rem] font-bold">{filtering ? "Where you can eat" : `Dining halls serving ${meal.toLowerCase()}`}</h1>
      <p className="pb-4 text-[0.95rem] text-muted">{filtering ? "Most options for you first." : "Choose what you avoid to see what fits."}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map(({ h, m, total, counts, closed }) => (
          <li key={h.id}>
            <Link
              href={hallHref(h.slug, date, meal)}
              className={`flex h-full items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-rule transition-shadow hover:shadow-md ${closed ? "opacity-60" : ""}`}
            >
              {!closed && <Ring fits={counts.fits} total={total} filtering={filtering} />}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.15rem] leading-tight font-bold">{h.name}</span>
                <span className="mt-0.5 block text-[0.92rem] text-muted">
                  {h.area ? `${h.area} campus, ` : ""}
                  {closed ? "closed for this meal" : `${time(m.startsAt)} to ${time(m.endsAt)}`}
                </span>
                {!closed && (
                  <span className="mt-2 flex flex-wrap gap-1.5 text-[0.83rem]">
                    {filtering ? (
                      <>
                        <span className="rounded-full bg-fit-tint px-2 py-0.5 font-bold text-fit">{counts.fits} fit you</span>
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
    </>
  );
}

/** Compact hall list for the sidebar (wide screens). */
export function HallNav({ halls, meal, date, selected }: { halls: Hall[]; meal: string; date: string; selected?: string }) {
  const prefs = usePrefs();
  const { rows, filtering } = useRows(halls, meal, prefs);
  return (
    <nav aria-label="Dining halls">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-[1.2rem] font-bold">Dining halls</h2>
        <Link href={`/?date=${date}&meal=${meal.toLowerCase()}`} className={`text-[0.88rem] underline underline-offset-2 ${selected ? "text-muted" : "font-bold text-brand"}`}>
          Overview
        </Link>
      </div>
      <ul className="space-y-0.5">
        {rows.map(({ h, counts, total, closed }) => {
          const on = h.slug === selected;
          return (
            <li key={h.id}>
              <Link
                href={hallHref(h.slug, date, meal)}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg border-l-4 py-2 pr-2 pl-3 text-[0.97rem] ${on ? "border-brand bg-brand-tint font-bold" : "border-transparent hover:bg-surface"} ${closed ? "opacity-60" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {closed ? (
                  <span className="text-[0.82rem] text-muted">closed</span>
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
      {filtering && <p className="mt-2 text-[0.82rem] text-muted">Number = items that fit you.</p>}
    </nav>
  );
}
