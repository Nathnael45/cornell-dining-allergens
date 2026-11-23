import Link from "next/link";
import { connection } from "next/server";
import { getDates, getDay, ithacaToday } from "@/lib/menu";
import { Band } from "./band";
import { DayNav, pickMeal, time } from "./day-nav";
import { HallMenu } from "./hall-menu";
import { RestrictionPanel, Restrictions } from "./restrictions";
import { HallList, HallNav } from "./today";

type SP = Record<string, string | string[] | undefined>;

/**
 * Page shell for one day + meal. Wide screens: red header, sidebar (what you avoid + dining halls),
 * main area (overview or one hall's menu). Phones: header with pills, then the main area.
 */
export async function DayView({ sp, slug }: { sp: SP; slug?: string }) {
  await connection(); // reads the clock (today, current meal) — must run per request
  const today = ithacaToday();
  const dates = await getDates(today);
  if (!dates.length) {
    return (
      <>
        <Band>
          <div className="h-4" />
        </Band>
        <p className="mx-auto max-w-6xl px-4 py-8 text-muted">No menus are available right now. Cornell posts them about a week ahead.</p>
      </>
    );
  }
  const date = dates.includes(String(sp.date)) ? String(sp.date) : dates[0];
  const day = await getDay(date);
  const hall = slug ? day.halls.find((h) => h.slug === slug) : undefined;

  // A hall with nothing posted (e.g. closed for a break) still gets the day's meal switch.
  const mealSource = hall?.meals.length ? hall.meals : day.halls.flatMap((h) => h.meals);
  const meals = ["Breakfast", "Brunch", "Lunch", "Dinner"].filter((m) => mealSource.some((x) => x.meal === m));
  const ends = Object.fromEntries(meals.map((m) => [m, mealSource.filter((x) => x.meal === m).map((x) => x.endsAt).sort().at(-1)!]));
  const meal = pickMeal(meals, ends, typeof sp.meal === "string" ? sp.meal : undefined, date === today, new Date());
  const current = hall?.meals.find((m) => m.meal === meal);

  return (
    <>
      <Band>
        <Restrictions />
        <DayNav base={hall ? `/halls/${hall.slug}` : "/"} dates={dates} date={date} today={today} meals={meals} meal={meal} />
      </Band>
      <div className="mx-auto max-w-6xl px-4 lg:grid lg:grid-cols-[19rem_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-0 max-h-dvh space-y-8 overflow-y-auto bg-side px-4 py-6 lg:-ml-4 lg:min-h-[calc(100dvh-8rem)]">
            <RestrictionPanel />
            <HallNav halls={day.halls} meal={meal} date={date} selected={hall?.slug} />
          </div>
        </aside>
        <div className="min-w-0">
          {slug && !hall && <p className="py-8 text-muted">This dining hall has no menu posted for that day.</p>}
          {hall && (
            <>
              <Link href={`/?date=${date}&meal=${meal.toLowerCase()}`} className="mt-4 inline-block text-[0.95rem] text-muted lg:hidden">
                <span aria-hidden>‹ </span>All dining halls
              </Link>
              <h1 className="pt-2 font-display text-[2rem] leading-tight font-bold lg:pt-6">{hall.name}</h1>
              <p className="text-muted">
                {hall.area ? `${hall.area} campus, ` : ""}
                {current ? `${meal.toLowerCase()} ${time(current.startsAt)} to ${time(current.endsAt)}` : hall.meals.length ? `no ${meal.toLowerCase()} this day` : "not open this day"}
              </p>
              {current ? (
                <HallMenu meal={current} eateryId={hall.id} />
              ) : (
                <p className="py-8 text-muted">
                  {hall.meals.length
                    ? `${hall.name} isn't serving ${meal.toLowerCase()} on this day.`
                    : `Cornell hasn't posted any meals at ${hall.name} for this day. It may be closed (for example, over a break).`}
                </p>
              )}
            </>
          )}
          {!slug && <HallList halls={day.halls} meal={meal} date={date} />}
        </div>
      </div>
    </>
  );
}
