/**
 * Allergen research model settings (ARCHITECTURE.md §6.4).
 *
 * Default: Claude Sonnet 5.5. The eval against Cornell's official labels (§9) decides whether
 * it meets the safety bar; override per run with RESEARCH_MODEL=claude-opus-5-5 to compare.
 */
export const RESEARCH_MODEL = process.env.RESEARCH_MODEL ?? "claude-sonnet-5-5";

/** Thinking depth. "high" is Sonnet 5.5's default; the eval can sweep this. */
export const RESEARCH_EFFORT = (process.env.RESEARCH_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";

/** Independent runs per food, merged conservatively (ARCHITECTURE.md §6.4 Step 4). */
export const RESEARCH_SAMPLES = Number(process.env.RESEARCH_SAMPLES ?? 2);
