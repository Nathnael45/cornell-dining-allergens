import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DayNav, pickMeal, time } from "@/components/day-nav";
import { HallMenu } from "@/components/hall-menu";
import { Band } from "@/components/band";
import { Restrictions } from "@/components/restrictions";
import { getDates, getDay, ithacaToday } from "@/lib/menu";

export default function HallPage(props: PageProps<"/halls/[slug]">) {
  return (
    <Suspense
      fallback={
        <>
          <Band top>
            <div className="h-48" />
          </Band>
          <p className="mx-auto max-w-2xl px-4 py-8 text-muted">Loading menu…</p>
        </>
      }
    >
      <Menu params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Menu({ params, searchParams }: { params: PageProps<"/halls/[slug]">["params"]; searchParams: PageProps<"/halls/[slug]">["searchParams"] }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  await connection(); // reads the clock (today, current meal) — must run per request
  const today = ithacaToday();
  const dates = await getDates(today);
  const date = dates.includes(String(sp.date)) ? String(sp.date) : (dates[0] ?? today);
  const day = await getDay(date);
  const hall = day.halls.find((h) => h.slug === slug);
  if (!hall) {
    if (!dates.length) notFound();
    return (
      <>
        <Band top>
          <BackLink />
          <div className="h-6" />
        </Band>
        <p className="mx-auto max-w-2xl px-4 py-8 text-muted">This dining hall has no menu posted for that day.</p>
      </>
    );
  }
  const meals = hall.meals.map((m) => m.meal);
  const meal = pickMeal(meals, Object.fromEntries(hall.meals.map((m) => [m.meal, m.endsAt])), typeof sp.meal === "string" ? sp.meal : undefined, date === today, new Date());
  const current = hall.meals.find((m) => m.meal === meal)!;

  return (
    <>
      <Band top>
        <BackLink />
        <h1 className="mt-1 font-display text-[2rem] leading-tight font-bold">{hall.name}</h1>
        <p className="text-band-muted">
          {hall.area ? `${hall.area} campus, ` : ""}
          {meal.toLowerCase()} {time(current.startsAt)} to {time(current.endsAt)}
        </p>
        <Restrictions />
        <DayNav base={`/halls/${hall.slug}`} dates={dates} date={date} today={today} meals={meals} meal={meal} />
      </Band>
      <div className="mx-auto max-w-2xl px-4">
        <HallMenu meal={current} eateryId={hall.id} />
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/" className="mt-3 block text-[0.95rem] text-band-muted">
      <span aria-hidden>‹ </span>All dining halls
    </Link>
  );
}
