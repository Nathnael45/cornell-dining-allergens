/**
 * One research call to Claude with schema-validated structured output.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildUserMessage, SYSTEM_PROMPT, type ResearchInput } from "./prompt";
import { ResearchOutputSchema, type ResearchOutput } from "./schema";
import { RESEARCH_EFFORT, RESEARCH_MODEL } from "./config";

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type LlmResult = { output: ResearchOutput; model: string; usage: Usage };

export class ResearchRefusal extends Error {}

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ maxRetries: 4 }));

export async function researchOnce(input: ResearchInput, opts: { model?: string; effort?: typeof RESEARCH_EFFORT } = {}): Promise<LlmResult> {
  const res = await getClient().beta.messages.parse({
    model: opts.model ?? RESEARCH_MODEL,
    max_tokens: 16000,
    // Server-side fallback if a safety classifier declines (unlikely for food questions).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? RESEARCH_EFFORT, format: betaZodOutputFormat(ResearchOutputSchema) },
    // Frozen system prompt first, so it is served from the prompt cache across foods.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  if (res.stop_reason === "refusal") {
    throw new ResearchRefusal(`model declined (${res.stop_details?.category ?? "unknown"}) for "${input.name}"`);
  }
  if (!res.parsed_output) throw new Error(`no parsed output for "${input.name}" (stop_reason=${res.stop_reason})`);

  return {
    output: res.parsed_output,
    model: res.model,
    usage: {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
      cacheRead: res.usage.cache_read_input_tokens ?? 0,
      cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/** $ per million tokens (first-party API list prices, 2026-11). Used for spend reporting only. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  // Cache writes bill at 1.25x input.
  return (u.input * p.input + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.cacheRead + u.output * p.output) / 1e6;
}
