"use client";
import { useMemo, useState } from "react";
import { GF_LABEL, LABEL, rateOptions, verdict, type CompactItem, type Prefs, type Verdict } from "@/lib/allergens/buckets";
import { OptionsSummary } from "./options";
import type { Resolved, Source } from "@/lib/allergens/resolve";
import { ASSESSED_ALLERGENS, type AssessedAllergen } from "@/lib/allergens/status";
import type { Meal } from "@/lib/menu";
import { usePrefs } from "./prefs";

const EMPTY: Prefs = { avoid: [], diets: [], strict: false };

export function HallMenu({ meal, eateryId }: { meal: Meal; eateryId: number }) {
  const prefs = usePrefs() ?? EMPTY;
  const filtering = prefs.avoid.length + prefs.diets.length > 0;

  if (!meal.stations.length) {
    return <p className="py-10 text-muted">{meal.notices.length ? meal.notices.join(". ") : "No menu has been posted for this meal yet."}</p>;
  }
  return (
    <>
      {filtering && <OptionsSummary o={rateOptions(meal.stations.flatMap((s) => s.items), prefs)} meal={meal.meal} />}
    <div className="pt-5 xl:columns-2 xl:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {meal.notices.length > 0 && <p className="rounded-2xl bg-check-tint px-4 py-3 text-[0.95rem] text-check">{meal.notices.join(". ")}</p>}
      {meal.stations.map((s) => (
        <StationPanel key={s.name} name={s.name} items={s.items} prefs={prefs} filtering={filtering} eateryId={eateryId} />
      ))}
    </div>
    </>
  );
}

function StationPanel(props: { name: string; items: CompactItem[]; prefs: Prefs; filtering: boolean; eateryId: number }) {
  const { name, items, prefs, filtering, eateryId } = props;
  const [showHidden, setShowHidden] = useState(false);
  const judged = useMemo(() => items.map((it) => ({ it, v: verdict(it, prefs) })), [items, prefs]);
  const order = { fits: 0, check: 1, avoid: 2 };
  const visible = judged.filter((j) => !filtering || j.v.bucket !== "avoid").sort((a, b) => order[a.v.bucket] - order[b.v.bucket]);
  const hidden = filtering ? judged.filter((j) => j.v.bucket === "avoid") : [];
  const fits = judged.filter((j) => j.v.bucket === "fits").length;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-rule" aria-labelledby={`st-${name}`}>
      <header className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
        <h2 id={`st-${name}`} className="font-display text-[1.15rem] font-bold">
          {name}
        </h2>
        {filtering && <span className="shrink-0 text-[0.85rem] text-muted">{fits ? `${fits} of ${items.length} fit` : "nothing fits"}</span>}
      </header>
      <ul>
        {visible.map(({ it, v }) => (
          <ItemRow key={it.id} item={it} v={v} prefs={prefs} filtering={filtering} eateryId={eateryId} station={name} />
        ))}
        {showHidden && hidden.map(({ it, v }) => <ItemRow key={it.id} item={it} v={v} prefs={prefs} filtering eateryId={eateryId} station={name} />)}
      </ul>
      {hidden.length > 0 && (
        <button type="button" onClick={() => setShowHidden(!showHidden)} className="w-full border-t border-rule px-4 py-2.5 text-left text-[0.92rem] text-muted">
          {showHidden ? "Hide" : "Show"} {hidden.length} not for you
        </button>
      )}
    </section>
  );
}

const PILL = {
  fits: { cls: "bg-fit-tint text-fit", text: "Fits", icon: "✓" },
  check: { cls: "bg-check-tint text-check", text: "Check", icon: "?" },
  avoid: { cls: "bg-avoid-tint text-muted", text: "Not for you", icon: "✕" },
} as const;

const ROLE_TAG: Record<string, string> = { side: "side", sauce: "sauce / topping", dessert: "dessert", drink: "drink", other: "other" };

const GF_STYLE: Record<string, string> = { d: "text-fit", l: "text-fit", s: "text-check", u: "text-muted" };

function ItemRow(props: { item: CompactItem; v: Verdict; prefs: Prefs; filtering: boolean; eateryId: number; station: string }) {
  const { item, v, prefs, filtering, eateryId, station } = props;
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
  const pill = PILL[v.bucket];
  const showGf = prefs.avoid.includes("gluten") && item.gf;
  const gf = item.gf?.toLowerCase() ?? "";

  return (
    <li className="border-t border-rule first:border-t-0">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block text-[1.04rem] leading-snug ${avoided ? "text-muted line-through decoration-1" : ""}`}>
            {item.name}
            {item.role && item.role !== "main" && <span className="ml-2 rounded bg-avoid-tint px-1.5 py-px align-middle text-[0.75rem] text-muted no-underline">{ROLE_TAG[item.role] ?? item.role}</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.88rem]">
            {showGf && (
              <span className={GF_STYLE[gf]}>
                Gluten-free: {GF_LABEL[gf]}
                {item.gf !== gf ? " (Cornell)" : ""}
              </span>
            )}
            {filtering && v.notes.filter((n) => !/gluten/i.test(n) || !showGf).length > 0 && (
              <span className={avoided ? "text-muted" : "text-check"}>{v.notes.filter((n) => !/gluten/i.test(n) || !showGf).join(", ")}</span>
            )}
            {item.fried && !avoided && <span className="text-muted">fried, may share fryer oil</span>}
          </span>
        </span>
        {filtering && (
          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.85rem] font-bold ${pill.cls}`}>
            <span aria-hidden>{pill.icon}</span>
            {pill.text}
          </span>
        )}
        <span aria-hidden className={`mt-0.5 text-muted transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {open && <Detail detail={detail} prefs={prefs} />}
    </li>
  );
}

const SOURCE: Record<Source, string> = { official: "Cornell label", policy: "Cornell certification", ai: "Estimated", none: "Not researched yet" };
const STATUS = { contains: "Contains", may_contain: "May contain", unknown: "Unknown", free: "None listed" } as const;

function Detail({ detail, prefs }: { detail: Resolved | null | "error"; prefs: Prefs }) {
  if (detail === null) return <p className="px-4 pb-4 text-[0.95rem] text-muted">Loading…</p>;
  if (detail === "error") return <p className="px-4 pb-4 text-[0.95rem] text-muted">Couldn&apos;t load details. Try again in a moment.</p>;

  const mine = prefs.avoid.filter((a) => a !== "gluten" || !detail.gf);
  const others = ASSESSED_ALLERGENS.filter((a) => !prefs.avoid.includes(a) && detail.allergens[a].status !== "free" && !(a === "gluten" && detail.gf));
  const row = (a: AssessedAllergen) => {
    const x = detail.allergens[a];
    return (
      <tr key={a} className="align-top">
        <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">
          {LABEL[a][0].toUpperCase() + LABEL[a].slice(1)}
        </th>
        <td className={`py-1 pr-3 font-bold whitespace-nowrap ${x.status === "contains" ? "" : x.status === "free" ? "text-fit" : "text-check"}`}>{STATUS[x.status]}</td>
        <td className="py-1 text-muted">
          {SOURCE[x.source]}
          {x.reason && !x.reason.startsWith("keyword floor") ? `: ${x.reason}` : ""}
        </td>
      </tr>
    );
  };

  return (
    <div className="mx-4 mb-4 rounded-xl bg-paper p-3 text-[0.94rem]">
      {!detail.researched && <p className="mb-2 text-check">We haven&apos;t researched this item yet. Treat everything as unknown.</p>}
      {detail.placeholder && <p className="mb-2 text-check">This changes day to day, so we can&apos;t say what&apos;s in it. Check the station.</p>}
      <table className="w-full">
        <tbody>
          {detail.gf && (
            <tr className="align-top">
              <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">
                Gluten-free
              </th>
              <td className={`py-1 pr-3 font-bold whitespace-nowrap ${detail.gf.rating === "unlikely" ? "" : detail.gf.rating === "less_likely" ? "text-check" : "text-fit"}`}>
                {GF_LABEL[{ definitely: "d", likely: "l", less_likely: "s", unlikely: "u" }[detail.gf.rating]]}
              </td>
              <td className="py-1 text-muted">
                {SOURCE[detail.gf.source]}
                {detail.gf.reason ? `: ${detail.gf.reason}` : ""}
              </td>
            </tr>
          )}
          {mine.map(row)}
          {others.map(row)}
        </tbody>
      </table>
      {detail.likelyIngredients.length > 0 && <p className="mt-2 text-muted">Usually made with {detail.likelyIngredients.slice(0, 10).join(", ")}.</p>}
      <p className="mt-1 text-muted">
        Vegetarian: {detail.diets.vegetarian}. Vegan: {detail.diets.vegan}.
      </p>
    </div>
  );
}
