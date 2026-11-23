"use client";
import Link from "next/link";
import { useMemo } from "react";
import { verdict } from "@/lib/allergens/buckets";
import type { Hall } from "@/lib/menu";
import { usePrefs } from "./prefs";
import { time } from "./day-nav";

const AREAS = ["North", "West", "Central"];

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
          const closed = m.notices.some((n) => /closed/i.test(n)) && items.length === 0;
          return { h, m, total: items.length, counts, closed };
        })
        .filter((r) => r !== null)
        .sort((a, b) => Number(a.closed) - Number(b.closed) || (filtering ? b.counts.fits - a.counts.fits : 0) || a.h.name.localeCompare(b.h.name)),
    [halls, meal, prefs, filtering],
  );

  if (!rows.length) return <p className="mt-8 text-muted">No dining hall lists a {meal.toLowerCase()} menu for this day.</p>;

  return (
    <ul className="mt-2">
      {rows.map(({ h, m, total, counts, closed }) => (
        <li key={h.id} className="border-b border-rule last:border-b-0">
          <Link href={`/halls/${h.slug}?date=${date}&meal=${meal.toLowerCase()}`} className="flex items-center gap-4 py-4">
            <span className="min-w-0 flex-1">
              <span className="block text-[1.15rem] font-bold">{h.name}</span>
              <span className="block text-[0.95rem] text-muted">
                {AREAS.includes(h.area ?? "") ? `${h.area} campus, ` : ""}
                {closed ? "closed for this meal" : `${time(m.startsAt)} to ${time(m.endsAt)}`}
              </span>
              {filtering && !closed && (counts.check > 0 || counts.avoid > 0) && (
                <span className="mt-0.5 block text-[0.9rem] text-muted">
                  {counts.check > 0 && <span className="text-check">{counts.check} to check</span>}
                  {counts.check > 0 && counts.avoid > 0 && ", "}
                  {counts.avoid > 0 && <span>{counts.avoid} not for you</span>}
                </span>
              )}
            </span>
            {!closed && (
              <span className="text-right">
                <span className={`block text-[2rem] leading-none font-bold tabular-nums ${filtering ? "text-fit" : ""}`}>
                  {filtering ? counts.fits : total}
                </span>
                <span className="block text-sm text-muted">{filtering ? "fit you" : "items"}</span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
