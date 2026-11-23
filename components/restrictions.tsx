"use client";
/**
 * The restriction sentence — "I eat: no gluten, no milk" — sits in the header band. Editing happens
 * in a bottom sheet that stays put while the sentence rewrites itself.
 */
import { useId, useState } from "react";
import { LABEL, type Diet } from "@/lib/allergens/buckets";
import type { AssessedAllergen } from "@/lib/allergens/status";
import { setPrefs, usePrefs } from "./prefs";

const MAJOR: AssessedAllergen[] = ["gluten", "milk", "egg", "peanuts", "tree_nuts", "soy", "wheat", "fish", "shellfish", "sesame"];
const OTHER: AssessedAllergen[] = ["coconut", "pork", "alcohol"];
const DIETS: Diet[] = ["vegetarian", "vegan"];

export function Restrictions() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!prefs) return <div className="h-[3.25rem]" aria-hidden />;

  const toggleA = (a: AssessedAllergen) =>
    setPrefs({ ...prefs, avoid: prefs.avoid.includes(a) ? prefs.avoid.filter((x) => x !== a) : [...prefs.avoid, a] });
  const toggleD = (d: Diet) => setPrefs({ ...prefs, diets: prefs.diets.includes(d) ? prefs.diets.filter((x) => x !== d) : [...prefs.diets, d] });
  const chosen = [
    ...prefs.diets.map((d) => ({ key: d, label: d, remove: () => toggleD(d) })),
    ...prefs.avoid.map((a) => ({ key: a, label: `no ${LABEL[a]}`, remove: () => toggleA(a) })),
  ];

  return (
    <section aria-label="Your dietary restrictions" className="pt-3 pb-1">
      {chosen.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-display text-[1.35rem] font-bold">I eat</span>
          {chosen.map((c) => (
            <span key={c.key} className="inline-flex items-center rounded-full bg-band-2 py-1 pr-1.5 pl-3 text-[0.98rem] ring-1 ring-white/15">
              {c.label}
              <button type="button" onClick={c.remove} aria-label={`Remove ${c.label}`} className="ml-1 grid size-6 place-items-center rounded-full text-band-muted hover:bg-white/10">
                ×
              </button>
            </span>
          ))}
          <EditButton open={open} setOpen={setOpen} panelId={panelId} label="Edit" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-[1.35rem] leading-snug font-bold">What do you avoid?</p>
          <EditButton open={open} setOpen={setOpen} panelId={panelId} label="Choose" />
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
            className="fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[80dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-12px_32px_rgb(0_0_0/0.18)]"
          >
            <p className="mb-4 font-display text-[1.25rem] font-bold">What do you avoid?</p>
            <Group title="Allergens" items={MAJOR.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(a) }))} />
            <Group title="Also labeled at Cornell" items={OTHER.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(a) }))} />
            <Group title="Diet" items={DIETS.map((d) => ({ key: d, label: d, on: prefs.diets.includes(d), toggle: () => toggleD(d) }))} />
            <label className="mt-2 flex items-start gap-3 rounded-2xl bg-paper p-3 text-[0.95rem]">
              <input type="checkbox" className="mt-1 size-5 accent-[var(--fit)]" checked={prefs.strict} onChange={() => setPrefs({ ...prefs, strict: !prefs.strict })} />
              <span>
                <span className="font-bold">Only count Cornell-verified info as a fit.</span>{" "}
                <span className="text-muted">Recommended for severe allergies. Estimated items move to “check”.</span>
              </span>
            </label>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full bg-band py-3.5 font-bold text-band-ink">
              Show what fits
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function EditButton({ open, setOpen, panelId, label }: { open: boolean; setOpen: (o: boolean) => void; panelId: string; label: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen(!open)}
      className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-[0.95rem] font-bold text-accent-ink"
    >
      {label}
    </button>
  );
}

function Group({ title, items }: { title: string; items: { key: string; label: string; on: boolean; toggle: () => void }[] }) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-[0.9rem] font-bold text-muted">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={i.on}
            onClick={i.toggle}
            className={`rounded-full px-4 py-2 text-[0.98rem] ring-1 transition-colors ${i.on ? "bg-band text-band-ink ring-band" : "bg-paper text-ink ring-rule"}`}
          >
            {i.on && <span aria-hidden>✓ </span>}
            {i.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
