/**
 * `npm run ai:check` — one tiny request to confirm the Anthropic key and model work (~$0.001).
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import Anthropic from "@anthropic-ai/sdk";
import { RESEARCH_MODEL } from "@/lib/research/config";

async function main() {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "In one short line: which major allergens are typically in hoisin sauce?" }],
  });
  if (res.stop_reason === "refusal") console.log("refused:", res.stop_details);
  for (const b of res.content) if (b.type === "text") console.log("reply:", b.text);
  console.log(`model: ${res.model} | stop: ${res.stop_reason} | tokens in/out: ${res.usage.input_tokens}/${res.usage.output_tokens}`);
}

main().catch((e) => {
  if (e instanceof Anthropic.AuthenticationError) console.error("Invalid ANTHROPIC_API_KEY (check .env.local)");
  else console.error(e);
  process.exitCode = 1;
});
