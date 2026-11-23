import { Suspense } from "react";
import { connection } from "next/server";
import { DayNav, pickMeal } from "@/components/day-nav";
import { Band } from "@/components/band";
import { Restrictions } from "@/components/restrictions";
import { HallList } from "@/components/today";
import { getDates, getDay, ithacaToday } from "@/lib/menu";

export default function Home(props: PageProps<"/">) {
  return (
    <>
      <Band top>
        <Restrictions />
      </Band>
      <Suspense
        fallback={
          <>
            <Band>
              <div className="h-[6.5rem]" />
            </Band>
            <p className="mx-auto max-w-2xl px-4 py-8 text-muted">Loading menus…</p>
          </>
        }
      >
        <Halls searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Halls({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  await connection(); // reads the clock (today, current meal) — must run per request
  const today = ithacaToday();
  const dates = await getDates(today);
  if (!dates.length) return <p className="mx-auto max-w-2xl px-4 py-8 text-muted">No menus are available right now. Cornell posts them about a week ahead.</p>;

  const date = dates.includes(String(sp.date)) ? String(sp.date) : dates[0];
  const day = await getDay(date);
  const ends = Object.fromEntries(day.meals.map((m) => [m, day.halls.flatMap((h) => h.meals.filter((x) => x.meal === m).map((x) => x.endsAt)).sort().at(-1)!]));
  const meal = pickMeal(day.meals, ends, typeof sp.meal === "string" ? sp.meal : undefined, date === today, new Date());

  return (
    <>
      <Band>
        <DayNav base="/" dates={dates} date={date} today={today} meals={day.meals} meal={meal} />
      </Band>
      <div className="mx-auto max-w-2xl px-4">
        <HallList halls={day.halls} meal={meal} date={date} />
      </div>
    </>
  );
}
