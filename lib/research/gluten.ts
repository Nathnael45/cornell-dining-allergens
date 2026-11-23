/**
 * Gluten-free likelihood: how likely is this dish, as typically made, to be gluten-free?
 * Recipe-based only — cross-contamination is deliberately ignored (user decision, 2026-11-23).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { RESEARCH_MODEL } from "./config";
import type { Usage } from "./llm";

export const GF_PROMPT_VERSION = "gf-2026-11-23.1";
export const GF_RATINGS = ["definitely", "likely", "less_likely", "unlikely"] as const;
export type GfRating = (typeof GF_RATINGS)[number];

const GF_SYSTEM = `You rate how likely a dish served in a university dining hall is to be gluten-free, based on how the dish is typically made.

Ratings:
- "definitely": the dish is inherently gluten-free; standard recipes never contain wheat, barley, rye, or malt (plain rice, steamed or roasted vegetables, fresh fruit, plain eggs, plain grilled meat or fish, beans cooked simply, corn tortillas, potatoes).
- "likely": most common versions are gluten-free, but some recipes add a gluten ingredient (a sauce, seasoning blend, or thickener).
- "less_likely": gluten is common in this dish: many versions use flour, soy sauce, breading, roux, or a gluten-containing grain.
- "unlikely": the dish is built on gluten (bread, buns, wraps, flour tortillas, pasta, pizza, noodles made from wheat, breaded or battered items, cakes, cookies, pastries, couscous, barley, seitan).

Rules:
- Judge only the recipe. Ignore cross-contamination, shared fryers, and shared prep surfaces entirely.
- "GF" or "gluten free" in the name means the kitchen made it gluten-free: rate "definitely" unless the name contradicts it.
- Hidden gluten to consider: soy sauce and teriyaki (unless tamari), malt vinegar, beer, roux-thickened soups and gravies, breadcrumbs in meatballs and meatloaf, flour dredging, seasoning blends, and regular oats.
- Rice noodles, corn, rice, quinoa, potatoes, and buckwheat are gluten-free grains.
- Keep the reason to a few words naming the deciding ingredient.`;

const GfSchema = z.object({
  rating: z.enum(GF_RATINGS),
  reason: z.string().describe("A few words, e.g. 'wheat flour tortilla' or 'plain steamed rice'"),
});

export type GfInput = { name: string; servedAt?: string[]; likelyIngredients?: string[]; references?: { name: string; contains: string[] | null }[] };
export type GfResult = { rating: GfRating; reason: string; model: string; usage: Usage; promptVersion: string };

let client: Anthropic | undefined;

export async function rateGlutenFree(input: GfInput, opts: { model?: string } = {}): Promise<GfResult> {
  const lines = [`Dish: ${input.name}`];
  if (input.servedAt?.length) lines.push(`Served at: ${input.servedAt.slice(0, 3).join("; ")}`);
  if (input.likelyIngredients?.length) lines.push(`Likely ingredients: ${input.likelyIngredients.slice(0, 12).join(", ")}`);
  if (input.references?.length)
    lines.push(
      "Similar Cornell items and their official allergen statements:",
      ...input.references.slice(0, 3).map((r) => `- ${r.name}: ${r.contains === null ? "no statement" : r.contains.join(", ") || "none listed"}`),
    );

  const res = await (client ??= new Anthropic({ maxRetries: 4 })).beta.messages.parse({
    model: opts.model ?? RESEARCH_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(GfSchema) },
    system: [{ type: "text", text: GF_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: lines.join("\n") }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`no gluten-free rating for "${input.name}" (${res.stop_reason})`);
  return {
    ...res.parsed_output,
    model: res.model,
    promptVersion: GF_PROMPT_VERSION,
    usage: {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
      cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
