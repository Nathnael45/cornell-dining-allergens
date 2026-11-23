"use client";
/**
 * The restriction sentence — "I avoid milk, sesame…" — edited in place. Everything below follows from it.
 */
import { useId, useState } from "react";
import { LABEL, type Diet, type Prefs } from "@/lib/allergens/buckets";
import type { AssessedAllergen } from "@/lib/allergens/status";
import { setPrefs, usePrefs } from "./prefs";

const MAJOR: AssessedAllergen[] = ["milk", "egg", "peanuts", "tree_nuts", "soy", "wheat", "gluten", "fish", "shellfish", "sesame"];
const OTHER: AssessedAllergen[] = ["coconut", "pork", "alcohol"];
const DIETS: Diet[] = ["vegetarian", "vegan"];

export function Restrictions() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!prefs) return <div className="h-24" aria-hidden />;

  const toggleA = (a: AssessedAllergen) =>
    setPrefs({ ...prefs, avoid: prefs.avoid.includes(a) ? prefs.avoid.filter((x) => x !== a) : [...prefs.avoid, a] });
  const toggleD = (d: Diet) => setPrefs({ ...prefs, diets: prefs.diets.includes(d) ? prefs.diets.filter((x) => x !== d) : [...prefs.diets, d] });
  const any = prefs.avoid.length + prefs.diets.length > 0;

  return (
    <section aria-label="Your dietary restrictions" className="pt-4 pb-2">
      <p className="text-[1.75rem] leading-[1.35] font-bold tracking-tight sm:text-[2rem]">
        {any ? (
          <>
            {prefs.diets.length > 0 && <>I eat {joinWords(prefs.diets.map((d) => d))}</>}
            {prefs.diets.length > 0 && prefs.avoid.length > 0 && " and "}
            {prefs.avoid.length > 0 && (prefs.diets.length ? "avoid " : "I avoid ")}
            {prefs.avoid.map((a, i) => (
              <span key={a}>
                <Chip label={LABEL[a]} onRemove={() => toggleA(a)} />
                {sep(i, prefs.avoid.length)}
              </span>
            ))}
          </>
        ) : (
          <>Tell us what you avoid, and we&apos;ll show what you can eat.</>
        )}{" "}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="align-middle text-base font-bold text-fit underline decoration-2 underline-offset-4"
        >
          {open ? "Done" : any ? "Edit" : "Choose"}
        </button>
      </p>
      {prefs.strict && any && <p className="mt-1 text-[0.95rem] text-muted">Only Cornell-verified information counts as a fit.</p>}

      {open && (
        // A bottom sheet: it stays put while the sentence above it rewrites itself, so taps never land
        // on a chip that just moved.
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose what you avoid"
          className="fixed inset-x-0 bottom-0 z-20 mx-auto max-h-[75dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border-t border-rule bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.12)]"
        >
          <Group title="Allergens" items={MAJOR.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(a) }))} />
          <Group title="Also labeled at Cornell" items={OTHER.map((a) => ({ key: a, label: LABEL[a], on: prefs.avoid.includes(a), toggle: () => toggleA(a) }))} />
          <Group title="Diet" items={DIETS.map((d) => ({ key: d, label: d, on: prefs.diets.includes(d), toggle: () => toggleD(d) }))} />
          <label className="mt-4 flex items-start gap-3 text-[0.95rem]">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--fit)]"
              checked={prefs.strict}
              onChange={() => setPrefs({ ...prefs, strict: !prefs.strict } satisfies Prefs)}
            />
            <span>
              <span className="font-bold">Only count Cornell-verified info as a fit.</span>{" "}
              <span className="text-muted">Recommended for severe allergies. Estimated items move to “check”.</span>
            </span>
          </label>
          <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full bg-ink py-3 font-bold text-paper">
            Show what fits
          </button>
        </div>
      )}
    </section>
  );
}

function Group({ title, items }: { title: string; items: { key: string; label: string; on: boolean; toggle: () => void }[] }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-2 text-sm font-bold text-muted">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={i.on}
            onClick={i.toggle}
            className={`rounded-full border px-3.5 py-1.5 text-[0.95rem] ${i.on ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink"}`}
          >
            {i.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="whitespace-nowrap">
      <span className="underline decoration-fit decoration-[3px] underline-offset-[6px]">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Stop avoiding ${label}`} className="ml-1 align-middle text-base text-muted">
        ×
      </button>
    </span>
  );
}

const sep = (i: number, n: number) => (i < n - 2 ? ", " : i === n - 2 ? (n > 2 ? ", and " : " and ") : "");
const joinWords = (w: string[]) => w.join(" and ");
