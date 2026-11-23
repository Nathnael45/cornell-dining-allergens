/**
 * Allergen research model settings (ARCHITECTURE.md §6.4).
 *
 * Default: Claude Sonnet 5.5. The eval against Cornell's official labels (§9) decides whether
 * it meets the safety bar; override per run with RESEARCH_MODEL=claude-opus-5-5 to compare.
 */
export const RESEARCH_MODEL = process.env.RESEARCH_MODEL ?? "claude-sonnet-5-5";
