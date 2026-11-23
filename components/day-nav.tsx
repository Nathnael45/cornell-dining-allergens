import Link from "next/link";

const TZ = "America/New_York";

export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  if ((d.getTime() - t.getTime()) / 864e5 === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(":00", "").toLowerCase();

/** Date pills + meal tabs. Plain links, so the URL is shareable ("dinner at Morrison tomorrow"). */
export function DayNav({ base, dates, date, today, meals, meal }: { base: string; dates: string[]; date: string; today: string; meals: string[]; meal: string }) {
  const href = (d: string, m?: string) => `${base}?date=${d}${m ? `&meal=${m.toLowerCase()}` : ""}`;
  return (
    <nav aria-label="Day and meal" className="mt-4 space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {dates.map((d) => (
          <Link
            key={d}
            href={href(d)}
            aria-current={d === date ? "date" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.95rem] ${d === date ? "bg-ink text-paper" : "bg-surface text-ink ring-1 ring-rule"}`}
          >
            {dayLabel(d, today)}
          </Link>
        ))}
      </div>
      {meals.length > 0 && (
        <div className="flex border-b border-rule">
          {meals.map((m) => (
            <Link
              key={m}
              href={href(date, m)}
              aria-current={m === meal ? "page" : undefined}
              className={`-mb-px border-b-[3px] px-3 py-2 text-[1.05rem] ${m === meal ? "border-ink font-bold" : "border-transparent text-muted"}`}
            >
              {m}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

/** Default meal: on today, the first one that hasn't ended yet; otherwise the first of the day. */
export function pickMeal(meals: string[], ends: Record<string, string>, requested: string | undefined, isToday: boolean, now: Date): string {
  const byName = meals.find((m) => m.toLowerCase() === requested?.toLowerCase());
  if (byName) return byName;
  if (isToday) return meals.find((m) => new Date(ends[m]) > now) ?? meals.at(-1) ?? "";
  return meals[0] ?? "";
}
