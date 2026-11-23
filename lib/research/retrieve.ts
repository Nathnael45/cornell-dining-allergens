/**
 * Retrieve the most similar official Cornell labels for a dish name (few-shot grounding,
 * ARCHITECTURE.md §6.4 Step 2). Simple weighted token overlap — no embeddings needed at this
 * scale (~500 labels), deterministic, and testable.
 */
import { nameKey } from "@/lib/ingest/normalize";

const STOP = new Set(["and", "with", "the", "of", "in", "on", "a", "fresh", "style", "house", "made", "cornell", "assorted", "w"]);

export function tokens(name: string): string[] {
  return nameKey(name)
    .split(" ")
    .map((t) => t.replace(/(ies)$/, "y").replace(/(?<=[a-z]{3})s$/, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export type LabelDoc = { nameKey: string; name: string; tokens: string[] };

export function buildIndex<T extends { name: string; nameKey: string }>(labels: T[]) {
  const docs = labels.map((l) => ({ label: l, tokens: new Set(tokens(l.name)) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + docs.length / (df.get(t) ?? 0.5));

  /** Top-k labels by idf-weighted overlap. `excludeKey` prevents leakage in evals (same dish). */
  return function search(name: string, k = 5, excludeKey?: string): T[] {
    const q = new Set(tokens(name));
    if (!q.size) return [];
    const qWeight = [...q].reduce((s, t) => s + idf(t), 0);
    const seen = new Set<string>();
    return docs
      .filter((d) => d.label.nameKey !== excludeKey)
      .map((d) => {
        let overlap = 0;
        for (const t of q) if (d.tokens.has(t)) overlap += idf(t);
        const dWeight = [...d.tokens].reduce((s, t) => s + idf(t), 0);
        return { d, score: overlap / Math.sqrt(qWeight * Math.max(dWeight, 1e-9)) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter((x) => (seen.has(x.d.label.nameKey) ? false : (seen.add(x.d.label.nameKey), true)))
      .slice(0, k)
      .map((x) => x.d.label);
  };
}
