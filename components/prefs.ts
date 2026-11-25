"use client";
/**
 * Dietary preferences live only in this browser (localStorage). The server never sees them.
 */
import { useSyncExternalStore } from "react";
import type { Prefs } from "@/lib/allergens/buckets";

const KEY = "dining-prefs-v1";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Prefs } | undefined;

const EMPTY: Prefs = { avoid: [], diets: [], strict: false };

function read(): Prefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage unavailable (private mode) — fall back to defaults */
  }
  if (cached && cached.raw === raw) return cached.value;
  let value = EMPTY;
  try {
    if (raw) value = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* corrupt value — ignore */
  }
  cached = { raw, value };
  return value;
}

export function setPrefs(next: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cached = { raw: JSON.stringify(next), value: next };
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** null during server render / before hydration, so nothing is filtered with wrong prefs. */
export function usePrefs(): Prefs | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Whether this browser has ever saved a choice (even "nothing"). null before hydration. */
export function useHasChosen(): boolean | null {
  return useSyncExternalStore(subscribe, () => (read(), cached!.raw !== null), () => null);
}
