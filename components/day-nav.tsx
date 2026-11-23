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

/** Day pills + a segmented meal switch, styled for the header band. Plain links → shareable URLs. */
export function DayNav({ base, dates, date, today, meals, meal }: { base: string; dates: string[]; date: string; today: string; meals: string[]; meal: string }) {
  const href = (d: string, m?: string) => `${base}?date=${d}${m ? `&meal=${m.toLowerCase()}` : ""}`;
  return (
    <nav aria-label="Day and meal" className="space-y-3 pt-3 pb-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {dates.map((d) => (
          <Link
            key={d}
            href={href(d)}
            aria-current={d === date ? "date" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.95rem] ${d === date ? "bg-band-ink font-bold text-band" : "text-band-muted ring-1 ring-white/15"}`}
          >
            {dayLabel(d, today)}
          </Link>
        ))}
      </div>
      {meals.length > 0 && (
        <div className="flex rounded-2xl bg-band-2 p-1 ring-1 ring-white/10">
          {meals.map((m) => (
            <Link
              key={m}
              href={href(date, m)}
              aria-current={m === meal ? "page" : undefined}
              className={`flex-1 rounded-xl py-2 text-center text-[1rem] ${m === meal ? "bg-accent font-bold text-accent-ink" : "text-band-ink"}`}
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
