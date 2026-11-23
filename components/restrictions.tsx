"use client";
/**
 * What you avoid. Wide screens: an always-visible panel in the sidebar.
 * Phones: your choices as pills in the red header, edited in a bottom sheet.
 */
import { useId, useState } from "react";
import { LABEL, type Diet, type Prefs } from "@/lib/allergens/buckets";
import type { AssessedAllergen } from "@/lib/allergens/status";
import { setPrefs, usePrefs } from "./prefs";

const MAJOR: AssessedAllergen[] = ["gluten", "milk", "egg", "peanuts", "tree_nuts", "soy", "wheat", "fish", "shellfish", "sesame"];
const OTHER: AssessedAllergen[] = ["coconut", "pork", "alcohol"];
const DIETS: Diet[] = ["vegetarian", "vegan"];

const toggleA = (p: Prefs, a: AssessedAllergen) => setPrefs({ ...p, avoid: p.avoid.includes(a) ? p.avoid.filter((x) => x !== a) : [...p.avoid, a] });
const toggleD = (p: Prefs, d: Diet) => setPrefs({ ...p, diets: p.diets.includes(d) ? p.diets.filter((x) => x !== d) : [...p.diets, d] });

/** The option groups + strict switch, shared by the sidebar panel and the phone sheet. */
function Options({ prefs }: { prefs: Prefs }) {
  return (
    <>
      <Group title="Allergens" items={MAJOR.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(prefs, a) }))} />
      <Group title="Also labeled at Cornell" items={OTHER.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(prefs, a) }))} />
      <Group title="Diet" items={DIETS.map((d) => ({ key: d, label: d, on: prefs.diets.includes(d), toggle: () => toggleD(prefs, d) }))} />
      <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-[0.92rem] ring-1 ring-rule">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={prefs.strict} onChange={() => setPrefs({ ...prefs, strict: !prefs.strict })} />
        <span>
          <span className="font-bold">Only count Cornell-verified info as a fit.</span>{" "}
          <span className="text-muted">For severe allergies. Estimated items move to “check”.</span>
        </span>
      </label>
    </>
  );
}

/** Sidebar version (wide screens). */
export function RestrictionPanel() {
  const prefs = usePrefs();
  if (!prefs) return <div className="h-72" aria-hidden />;
  const n = prefs.avoid.length + prefs.diets.length;
  return (
    <section aria-label="What you avoid">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[1.2rem] font-bold">What you avoid</h2>
        {n > 0 && (
          <button type="button" onClick={() => setPrefs({ ...prefs, avoid: [], diets: [] })} className="text-[0.88rem] text-muted underline underline-offset-2">
            Clear
          </button>
        )}
      </div>
      <Options prefs={prefs} />
    </section>
  );
}

/** Phone version: pills in the header + bottom sheet. Hidden on wide screens (the sidebar has it). */
export function Restrictions() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!prefs) return <div className="h-[3.25rem] lg:hidden" aria-hidden />;

  const chosen = [
    ...prefs.diets.map((d) => ({ key: d, label: d, remove: () => toggleD(prefs, d) })),
    ...prefs.avoid.map((a) => ({ key: a, label: `no ${LABEL[a]}`, remove: () => toggleA(prefs, a) })),
  ];
  const edit = (label: string) => (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen(!open)}
      className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-[0.92rem] font-bold text-accent-ink"
    >
      {label}
    </button>
  );

  return (
    <section aria-label="Your dietary restrictions" className="pt-2 lg:hidden">
      {chosen.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-display text-[1.15rem] font-bold">I eat</span>
          {chosen.map((c) => (
            <span key={c.key} className="inline-flex items-center rounded-full bg-band-2 py-0.5 pr-1 pl-2.5 text-[0.92rem]">
              {c.label}
              <button type="button" onClick={c.remove} aria-label={`Remove ${c.label}`} className="ml-1 grid size-6 place-items-center rounded-full text-band-muted hover:bg-white/10">
                ×
              </button>
            </span>
          ))}
          {edit("Edit")}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[1.15rem] leading-snug font-bold">What do you avoid?</p>
          {edit("Choose")}
        </div>
      )}
      {prefs.strict && chosen.length > 0 && <p className="mt-2 text-[0.92rem] text-band-muted">Only Cornell-verified information counts as a fit.</p>}

      {open && (
        <>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 bg-black/30" />
          <div
            id={panelId}
            role="dialog"
            aria-label="Choose what you avoid"
            className="fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[80dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-side px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-12px_32px_rgb(0_0_0/0.18)]"
          >
            <p className="mb-4 font-display text-[1.25rem] font-bold">What do you avoid?</p>
            <Options prefs={prefs} />
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full bg-band py-3.5 font-bold text-band-ink">
              Show what fits
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Group({ title, items }: { title: string; items: { key: string; label: string; on: boolean; toggle: () => void }[] }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-[0.88rem] font-bold text-muted">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={i.on}
            onClick={i.toggle}
            className={`rounded-full px-3.5 py-1.5 text-[0.95rem] ring-1 transition-colors ${i.on ? "bg-brand text-white ring-brand" : "bg-surface text-ink ring-rule hover:ring-muted"}`}
          >
            {i.on && <span aria-hidden>✓ </span>}
            {i.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
