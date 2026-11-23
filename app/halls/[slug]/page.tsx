import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DayNav, pickMeal, time } from "@/components/day-nav";
import { HallMenu } from "@/components/hall-menu";
import { Restrictions } from "@/components/restrictions";
import { getDates, getDay, ithacaToday } from "@/lib/menu";

export default function HallPage(props: PageProps<"/halls/[slug]">) {
  return (
    <>
      <Link href="/" className="mt-2 inline-block text-[0.95rem] text-muted underline underline-offset-4">
        All dining halls
      </Link>
      <Restrictions />
      <Suspense fallback={<p className="mt-8 text-muted">Loading menu…</p>}>
        <Menu params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
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
    return <p className="mt-8 text-muted">This dining hall has no menu posted for that day.</p>;
  }
  const meals = hall.meals.map((m) => m.meal);
  const meal = pickMeal(meals, Object.fromEntries(hall.meals.map((m) => [m.meal, m.endsAt])), typeof sp.meal === "string" ? sp.meal : undefined, date === today, new Date());
  const current = hall.meals.find((m) => m.meal === meal)!;

  return (
    <>
      <h1 className="mt-6 text-[1.6rem] leading-tight font-bold">{hall.name}</h1>
      <p className="text-muted">
        {meal} {time(current.startsAt)} to {time(current.endsAt)}
      </p>
      <DayNav base={`/halls/${hall.slug}`} dates={dates} date={date} today={today} meals={meals} meal={meal} />
      <HallMenu meal={current} eateryId={hall.id} />
    </>
  );
}
