"use client";
import { useMemo, useState } from "react";
import { LABEL, verdict, type CompactItem, type Prefs, type Verdict } from "@/lib/allergens/buckets";
import type { Resolved, Source } from "@/lib/allergens/resolve";
import { ASSESSED_ALLERGENS, type AssessedAllergen } from "@/lib/allergens/status";
import type { Meal } from "@/lib/menu";
import { usePrefs } from "./prefs";

const EMPTY: Prefs = { avoid: [], diets: [], strict: false };

export function HallMenu({ meal, eateryId }: { meal: Meal; eateryId: number }) {
  const prefs = usePrefs() ?? EMPTY;
  const filtering = prefs.avoid.length + prefs.diets.length > 0;

  if (!meal.stations.length) {
    return (
      <p className="mt-8 text-muted">
        {meal.notices.length ? meal.notices.join(". ") : "No menu has been posted for this meal yet."}
      </p>
    );
  }

  return (
    <div className="mt-2">
      {meal.notices.length > 0 && <p className="mt-4 rounded-lg bg-check-tint px-3 py-2 text-[0.95rem]">{meal.notices.join(". ")}</p>}
      {meal.stations.map((s) => (
        <StationSection key={s.name} name={s.name} items={s.items} prefs={prefs} filtering={filtering} eateryId={eateryId} />
      ))}
    </div>
  );
}

function StationSection(props: { name: string; items: CompactItem[]; prefs: Prefs; filtering: boolean; eateryId: number }) {
  const { name, items, prefs, filtering, eateryId } = props;
  const [showHidden, setShowHidden] = useState(false);
  const judged = useMemo(() => items.map((it) => ({ it, v: verdict(it, prefs) })), [items, prefs]);
  const order = { fits: 0, check: 1, avoid: 2 };
  const visible = judged.filter((j) => !filtering || j.v.bucket !== "avoid").sort((a, b) => order[a.v.bucket] - order[b.v.bucket]);
  const hidden = filtering ? judged.filter((j) => j.v.bucket === "avoid") : [];

  return (
    <section className="mt-7" aria-labelledby={`st-${name}`}>
      <h2 id={`st-${name}`} className="text-[1.2rem] font-bold">
        {name}
      </h2>
      <ul className="mt-1">
        {visible.map(({ it, v }) => (
          <ItemRow key={it.id} item={it} v={v} filtering={filtering} eateryId={eateryId} station={name} />
        ))}
        {showHidden && hidden.map(({ it, v }) => <ItemRow key={it.id} item={it} v={v} filtering eateryId={eateryId} station={name} />)}
      </ul>
      {hidden.length > 0 && (
        <button type="button" onClick={() => setShowHidden(!showHidden)} className="mt-1 text-[0.95rem] text-muted underline underline-offset-4">
          {showHidden ? "Hide" : "Show"} {hidden.length} not for you
        </button>
      )}
    </section>
  );
}

function Mark({ v }: { v: Verdict }) {
  if (v.bucket === "fits")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-fit-tint px-2.5 py-0.5 text-[0.9rem] font-bold text-fit">
        <span aria-hidden>✓</span>Fits
      </span>
    );
  if (v.bucket === "check")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-check-tint px-2.5 py-0.5 text-[0.9rem] font-bold text-check">
        <span aria-hidden>?</span>Check
      </span>
    );
  return <span className="text-[0.9rem] font-bold text-avoid">Not for you</span>;
}

function ItemRow({ item, v, filtering, eateryId, station }: { item: CompactItem; v: Verdict; filtering: boolean; eateryId: number; station: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Resolved | null | "error">(null);
  const toggle = async () => {
    setOpen(!open);
    if (!open && detail === null) {
      try {
        const res = await fetch(`/api/foods/${item.id}?eatery=${eateryId}&station=${encodeURIComponent(station)}`);
        setDetail(res.ok ? await res.json() : "error");
      } catch {
        setDetail("error");
      }
    }
  };
  const avoided = v.bucket === "avoid";

  return (
    <li className="border-b border-rule last:border-b-0">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full items-start gap-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block text-[1.05rem] ${avoided ? "text-avoid line-through decoration-1" : ""}`}>{item.name}</span>
          {filtering && v.notes.length > 0 && <span className={`block text-[0.9rem] ${avoided ? "text-avoid" : "text-check"}`}>{v.notes.join(", ")}</span>}
          {item.fried && !avoided && <span className="block text-[0.9rem] text-muted">Fried, may share fryer oil</span>}
        </span>
        {filtering && <Mark v={v} />}
      </button>
      {open && <Detail detail={detail} />}
    </li>
  );
}

const SOURCE: Record<Source, string> = { official: "Cornell label", policy: "Cornell certification", ai: "Estimated", none: "Not researched yet" };
const STATUS = { contains: "Contains", may_contain: "May contain", unknown: "Unknown", free: "None listed" } as const;

function Detail({ detail }: { detail: Resolved | null | "error" }) {
  const prefs = usePrefs() ?? EMPTY;
  if (detail === null) return <p className="pb-3 text-[0.95rem] text-muted">Loading…</p>;
  if (detail === "error") return <p className="pb-3 text-[0.95rem] text-muted">Couldn&apos;t load details. Try again in a moment.</p>;

  const mine = prefs.avoid;
  const others = ASSESSED_ALLERGENS.filter((a) => !mine.includes(a) && detail.allergens[a].status !== "free");
  const row = (a: AssessedAllergen) => {
    const x = detail.allergens[a];
    return (
      <tr key={a} className="align-top">
        <th scope="row" className="py-1 pr-3 text-left font-normal">
          {LABEL[a][0].toUpperCase() + LABEL[a].slice(1)}
        </th>
        <td className={`py-1 pr-3 font-bold ${x.status === "contains" ? "" : x.status === "free" ? "text-fit" : "text-check"}`}>{STATUS[x.status]}</td>
        <td className="py-1 text-muted">
          {SOURCE[x.source]}
          {x.reason && !x.reason.startsWith("keyword floor") ? `: ${x.reason}` : ""}
        </td>
      </tr>
    );
  };

  return (
    <div className="mb-4 rounded-lg bg-surface p-3 text-[0.95rem] ring-1 ring-rule">
      {!detail.researched && <p className="mb-2 text-check">We haven&apos;t researched this item yet. Treat everything as unknown.</p>}
      {detail.placeholder && <p className="mb-2 text-check">This changes day to day, so we can&apos;t say what&apos;s in it. Check the station.</p>}
      <table className="w-full">
        <tbody>
          {mine.map(row)}
          {others.map(row)}
        </tbody>
      </table>
      {mine.length === 0 && others.length === 0 && <p className="text-muted">No allergens listed.</p>}
      {detail.likelyIngredients.length > 0 && (
        <p className="mt-2 text-muted">Usually made with {detail.likelyIngredients.slice(0, 10).join(", ")}.</p>
      )}
      <p className="mt-2 text-muted">
        Vegetarian: {detail.diets.vegetarian}. Vegan: {detail.diets.vegan}.
      </p>
    </div>
  );
}
