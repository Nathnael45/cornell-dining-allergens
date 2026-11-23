"use client";
import Link from "next/link";
import { useMemo } from "react";
import { verdict } from "@/lib/allergens/buckets";
import type { Hall } from "@/lib/menu";
import { usePrefs } from "./prefs";
import { time } from "./day-nav";

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
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={filtering ? "var(--fit)" : "var(--avoid)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
        />
        )}
      </svg>
      <span className={`font-display text-[1.35rem] leading-none font-bold tabular-nums ${filtering ? "text-fit" : ""}`}>{filtering ? fits : total}</span>
    </div>
  );
}

/** Halls for one meal, ranked by how much fits the reader's restrictions. */
export function HallList({ halls, meal, date }: { halls: Hall[]; meal: string; date: string }) {
  const prefs = usePrefs();
  const filtering = !!prefs && prefs.avoid.length + prefs.diets.length > 0;

  const rows = useMemo(
    () =>
      halls
        .map((h) => {
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

  if (!rows.length) return <p className="py-10 text-muted">No dining hall lists a {meal.toLowerCase()} menu for this day.</p>;

  return (
    <>
      <p className="pt-5 pb-3 text-[0.95rem] text-muted">
        {filtering ? `${rows.length} dining halls, most options for you first` : `${rows.length} dining halls serving ${meal.toLowerCase()}`}
      </p>
      <ul className="space-y-3">
        {rows.map(({ h, m, total, counts, closed }) => (
          <li key={h.id}>
            <Link
              href={`/halls/${h.slug}?date=${date}&meal=${meal.toLowerCase()}`}
              className={`flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-rule transition-shadow hover:shadow-md ${closed ? "opacity-60" : ""}`}
            >
              {!closed && <Ring fits={counts.fits} total={total} filtering={filtering} />}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.2rem] leading-tight font-bold">{h.name}</span>
                <span className="mt-0.5 block text-[0.95rem] text-muted">
                  {h.area ? `${h.area} campus` : ""}
                  {h.area ? ", " : ""}
                  {closed ? "closed for this meal" : `${time(m.startsAt)} to ${time(m.endsAt)}`}
                </span>
                {!closed && (
                  <span className="mt-2 flex flex-wrap gap-1.5 text-[0.85rem]">
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
